const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  members: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      role: {
        type: String,
        enum: ['student', 'faculty'],
      },
    },
  ],
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'cancelled'],
    default: 'pending',
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
  },
  aiPlanStatus: {
    type: String,
    enum: ['pending_review', 'approved', 'rejected'],
    default: 'pending_review',
  },
  aiPlanDetails: {
    type: Object, // To store the AI-generated tasks and milestones
  },
  teamLeaderApprovedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  // Faculty assigned to monitor/mentor this project
  assignedFaculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  facultyEvaluation: {
    type: String,
  },
  projectGrade: {
    type: String,
    enum: ['A', 'B', 'C', 'D', 'F', 'N/A'],
    default: 'N/A',
  },
  // Faculty suggestions/feedback visible to students
  facultySuggestions: [
    {
      faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      message: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
    },
  ],
}, { timestamps: true });

module.exports = mongoose.model('Project', ProjectSchema);
