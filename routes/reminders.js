const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');

// Heuristic scoring for reminders
function scoreTaskForReminder(task, now) {
  const dueTime = task.dueDate ? new Date(task.dueDate).getTime() : null;
  const msUntilDue = dueTime ? (dueTime - now.getTime()) : Number.POSITIVE_INFINITY;
  const daysUntilDue = isFinite(msUntilDue) ? Math.ceil(msUntilDue / (24 * 60 * 60 * 1000)) : 9999;

  let score = 0;
  // Overdue or due soon has highest weight
  if (!isFinite(msUntilDue)) {
    score += 0; // No due date
  } else if (msUntilDue < 0) {
    score += 1000; // Overdue
  } else if (daysUntilDue <= 1) {
    score += 800; // Due today/tomorrow
  } else if (daysUntilDue <= 3) {
    score += 600;
  } else if (daysUntilDue <= 7) {
    score += 400;
  } else {
    score += 200;
  }

  // Priority weight
  const priorityWeights = { high: 200, medium: 100, low: 50 };
  score += priorityWeights[(task.priority || 'medium')] || 0;

  // Status penalty (completed should be ignored by caller, but guard anyway)
  if ((task.status || '').toLowerCase() === 'completed') {
    score -= 1000;
  }

  return { score, daysUntilDue };
}

function buildReminderMessage(task, daysUntilDue) {
  const name = task.name || 'Task';
  const dueStr = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'no due date';
  const priority = (task.priority || 'medium').toUpperCase();

  let urgencyTip = '';
  if (task.dueDate) {
    if (daysUntilDue < 0) urgencyTip = 'This is overdue. Start immediately.';
    else if (daysUntilDue <= 1) urgencyTip = 'Due within 24 hours. Block focused time now.';
    else if (daysUntilDue <= 3) urgencyTip = 'High urgency. Plan concrete steps today.';
    else if (daysUntilDue <= 7) urgencyTip = 'Break into daily sub-tasks to stay on track.';
    else urgencyTip = 'Schedule initial work to avoid last-minute rush.';
  } else {
    urgencyTip = 'No deadline set. Consider adding one for better tracking.';
  }

  // Simple duration heuristic based on priority
  const durationHint = priority === 'HIGH' ? 'This typically needs 2-3 focused sessions.' :
                       priority === 'MEDIUM' ? 'Allocate at least one focused session.' :
                       'You can slot this between bigger tasks.';

  return `${name} (Priority: ${priority}, Due: ${dueStr}). ${urgencyTip} ${durationHint}`;
}

// @route   POST /api/reminders/generate
// @desc    Generate prioritized, grouped reminders for a project or provided tasks
// @access  Private
router.post('/generate', auth, async (req, res) => {
  try {
    const { projectId, tasks } = req.body || {};

    let taskList = Array.isArray(tasks) ? tasks : null;
    if (!taskList && projectId) {
      // Load tasks from DB for the given project
      const dbTasks = await Task.find({ project: projectId }).lean();
      taskList = dbTasks;
    }

    if (!taskList) {
      return res.status(400).json({ msg: 'Provide projectId or tasks array.' });
    }

    // Filter out completed tasks
    taskList = taskList.filter(t => (t.status || '').toLowerCase() !== 'completed');

    const now = new Date();
    const scored = taskList.map(t => {
      const { score, daysUntilDue } = scoreTaskForReminder(t, now);
      return { task: t, score, daysUntilDue };
    });

    // Sort by score desc, tie-breaker sooner due date, then high priority
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ad = isFinite(a.daysUntilDue) ? a.daysUntilDue : 9999;
      const bd = isFinite(b.daysUntilDue) ? b.daysUntilDue : 9999;
      if (ad !== bd) return ad - bd;
      const prioOrder = { high: 0, medium: 1, low: 2 };
      return (prioOrder[(a.task.priority || 'medium')]) - (prioOrder[(b.task.priority || 'medium')]);
    });

    // Group related tasks by simple keyword overlap (very light heuristic)
    const groups = [];
    const used = new Set();
    function keywords(str) {
      return (str || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w && w.length > 2);
    }

    for (let i = 0; i < scored.length; i++) {
      if (used.has(i)) continue;
      const base = scored[i];
      const baseWords = new Set(keywords(base.task.name + ' ' + (base.task.description || '')));
      const group = [base];
      used.add(i);
      for (let j = i + 1; j < scored.length; j++) {
        if (used.has(j)) continue;
        const cand = scored[j];
        const candWords = new Set(keywords(cand.task.name + ' ' + (cand.task.description || '')));
        // overlap threshold
        let overlap = 0;
        candWords.forEach(w => { if (baseWords.has(w)) overlap++; });
        if (overlap >= 2) {
          group.push(cand);
          used.add(j);
        }
      }
      groups.push(group);
    }

    // Build reminders output
    const reminders = groups.map(group => {
      // Highest score item leads the title
      const leader = group[0];
      const items = group.map(g => ({
        taskId: String(g.task._id || g.task.id || ''),
        name: g.task.name,
        priority: g.task.priority || 'medium',
        dueDate: g.task.dueDate || null,
        message: buildReminderMessage(g.task, g.daysUntilDue),
        score: g.score,
      }));
      const groupPriority = items.some(i => (i.priority || '').toLowerCase() === 'high') ? 'high'
                           : items.some(i => (i.priority || '').toLowerCase() === 'medium') ? 'medium'
                           : 'low';
      return {
        title: `Focus: ${leader.task.name}`,
        priority: groupPriority,
        items,
      };
    });

    // Flatten a top list as well
    const topList = scored.slice(0, 5).map(s => ({
      taskId: String(s.task._id || s.task.id || ''),
      name: s.task.name,
      priority: s.task.priority || 'medium',
      dueDate: s.task.dueDate || null,
      message: buildReminderMessage(s.task, s.daysUntilDue),
      score: s.score,
    }));

    return res.json({
      msg: 'Reminders generated',
      top: topList,
      groups: reminders,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Reminders error:', err && err.message ? err.message : err);
    return res.status(500).json({ msg: 'Server Error', error: err && err.message ? err.message : String(err) });
  }
});

module.exports = router;


