import uuid from 'uuid';

const trackView = async (req, res, next) => {
  const sessionId = req.cookies.sessionId || uuid.v4();
  res.cookie('sessionId', sessionId, { maxAge: 24 * 60 * 60 * 1000 }); // 24 hours

  req.viewData = {
    sessionId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.user?._id,
  };

  next();
};

export default trackView;
