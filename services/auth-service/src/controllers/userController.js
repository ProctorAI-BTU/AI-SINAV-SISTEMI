const userService = require('../services/userService');

exports.getAllUsers = async (req, res, next) => {
  try {
    const { role } = req.query;
    const users = await userService.getAllUsers(role);
    res.json({
      success: true,
      data: { users },
    });
  } catch (error) {
    next(error);
  }
};

exports.generateInstructorCode = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const code = await userService.generateInstructorCode(adminId);
    res.status(201).json({
      success: true,
      data: { code },
    });
  } catch (error) {
    next(error);
  }
};

exports.listInstructorCodes = async (req, res, next) => {
  try {
    const codes = await userService.listInstructorCodes();
    res.json({
      success: true,
      data: { codes },
    });
  } catch (error) {
    next(error);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const user = await userService.createUser({
      name,
      email,
      password,
      role: role || 'instructor',
      instructorCode: 'EGITMEN-AI-2024'
    });
    res.status(201).json({
      success: true,
      data: {
        user: { id: user._id, name: user.name, email: user.email, role: user.role }
      }
    });
  } catch (error) {
    next(error);
  }
};
