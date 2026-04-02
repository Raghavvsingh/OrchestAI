import React from 'react';

function ReviewQueue() {
  // This component would show pending reviews in a production app
  return (
    <div className="p-8 bg-slate-800 rounded-xl border border-slate-700 text-center">
      <h2 className="text-xl font-semibold text-white mb-4">Review Queue</h2>
      <p className="text-slate-400">No items pending review</p>
    </div>
  );
}

export default ReviewQueue;
