export const studioPollDelay = ({hidden=false,pending=false,jobs=[]}={}) => hidden?120000:
  pending||jobs.some(job=>['queued','preparing','submitting','processing','needs_review'].includes(job.status))?15000:60000;
