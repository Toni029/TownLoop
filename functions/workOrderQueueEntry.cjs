// Isolated read-only deployment: no workers, schedules, rules or other callables.
require('firebase-admin/app').initializeApp();
exports.getWorkOrderQueuePositions=require('./workOrderQueue.cjs').getWorkOrderQueuePositions;
