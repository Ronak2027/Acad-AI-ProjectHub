const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const File = require('../models/File');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// @route   POST api/files/upload/:projectId
// @desc    Upload a file for a project
// @access  Private
router.post('/upload/:projectId', auth, async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ msg: 'No files were uploaded.' });
    }

    const { projectId } = req.params;
    const uploadedFile = req.files.file;

    const filePath = path.join(uploadDir, uploadedFile.name);

    await uploadedFile.mv(filePath);

    const newFile = new File({
      project: projectId,
      task: null,
      fileName: uploadedFile.name,
      filePath: filePath,
      fileType: uploadedFile.mimetype,
      uploadedBy: req.user.id,
    });

    const file = await newFile.save();
    res.json(file);

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/files/upload/:projectId/:taskId
// @desc    Upload a file for a specific task within a project
// @access  Private
router.post('/upload/:projectId/:taskId', auth, async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ msg: 'No files were uploaded.' });
    }

    const { projectId, taskId } = req.params;
    const uploadedFile = req.files.file;

    const filePath = path.join(uploadDir, uploadedFile.name);

    await uploadedFile.mv(filePath);

    const newFile = new File({
      project: projectId,
      task: taskId,
      fileName: uploadedFile.name,
      filePath: filePath,
      fileType: uploadedFile.mimetype,
      uploadedBy: req.user.id,
    });

    const file = await newFile.save();
    res.json(file);

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/files/project/:projectId
// @desc    Get all files for a project
// @access  Private
router.get('/project/:projectId', auth, async (req, res) => {
  try {
    const files = await File.find({ project: req.params.projectId }).populate('uploadedBy', 'username');
    res.json(files);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/files/:fileId/ai-organise
// @desc    Get AI-suggested tags/categories for a file
// @access  Private
router.post('/:fileId/ai-organise', auth, async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({ msg: 'File not found' });
    }

    // In a real application, you might read a snippet of the file content
    // For this example, we'll use the filename and type as context for AI.
    const prompt = `Given a file named "${file.fileName}" of type "${file.fileType}", suggest 3-5 relevant tags or categories. Format the output as a JSON array of strings. For example: ["report", "finance", "Q3"].`;

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    let aiSuggestedTags;
    try {
      aiSuggestedTags = JSON.parse(text);
      if (!Array.isArray(aiSuggestedTags)) {
        throw new Error("AI response is not an array.");
      }
    } catch (parseError) {
      console.error('Error parsing AI response for file organization:', parseError);
      console.error('AI Raw Response:', text);
      aiSuggestedTags = ['Could not generate AI tags at this time.'];
    }

    res.json({ msg: 'AI suggested tags for file', aiSuggestedTags });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/files/:fileId
// @desc    Delete a file by ID (DB and disk)
// @access  Private
router.delete('/:fileId', auth, async (req, res) => {
  try {
    const { fileId } = req.params;
    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({ msg: 'File not found' });
    }

    // Delete physical file if it exists
    try {
      if (file.filePath && fs.existsSync(file.filePath)) {
        fs.unlinkSync(file.filePath);
      }
    } catch (fsErr) {
      console.warn('Failed to remove file from disk:', fsErr.message);
      // proceed to remove DB record regardless
    }

    await file.deleteOne();
    return res.json({ msg: 'File deleted successfully' });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send('Server Error');
  }
});

module.exports = router;
