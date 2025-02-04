import jwt from 'jsonwebtoken';
import userModel from '../models/userModel.js';

const authUser = async (req, res, next) => {
  // const token = req.header('Authorization')?.replace('Bearer ', '');
  const token = req.headers['authorization']
    ? req.headers['authorization'].split(' ')[1]
    : null;


  if (!token) {
    return res
      .status(400)
      .json({ success: false, message: 'Not Authorized Login Again' });
  }

  try {
    const token_decode = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findById(token_decode.id);
    req.body.userId = token_decode.id;
    req.user = user;
    next();
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export default authUser;
