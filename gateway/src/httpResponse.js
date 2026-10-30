// A client can disconnect while dispatch awaits a remote image. Never wait for
// a close event that has already happened, or retain the media queue permit.
export const endResponse = (response, bytes) => new Promise((resolve) => {
  if (response.destroyed || response.writableFinished) return resolve();
  const done = () => {
    response.off('finish', done);
    response.off('close', done);
    resolve();
  };
  response.once('finish', done);
  response.once('close', done);
  response.end(bytes);
});
