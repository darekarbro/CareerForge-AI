const authService = require('../services/authService');

const register = async (req, res, next) => {
  try {
    const { name, email, password, targetRolePreference } = req.body;
    const result = await authService.register({ name, email, password, targetRolePreference });
    res.status(201).json({
      success: true,
      message: 'Account registered successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

const firebaseLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    const result = await authService.firebaseLogin({ idToken });
    res.status(200).json({
      success: true,
      message: 'Google sign-in successful',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user._id);
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const user = await authService.updateProfile(req.user._id, req.body);
    res.status(200).json({
      success: true,
      message: 'Profile updated',
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  firebaseLogin,
  getMe,
  updateProfile,
};
