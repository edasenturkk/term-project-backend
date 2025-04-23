const express = require('express');
const { check } = require('express-validator');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  getUsers,
  deleteUser,
  updateUser,
  getUserStats,
  getMostPlayedGame,
  getUserComments,
  getUserDashboard,
  getUserPage
} = require('../controllers/userController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public routes
router.post(
  '/',
  [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
  ],
  registerUser
);

router.post(
  '/login',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists(),
  ],
  loginUser
);

// Private routes
router.route('/profile')
  .get(protect, getUserProfile)
  .put(protect, updateUserProfile);

// User statistics routes
router.route('/stats').get(protect, getUserStats);
router.route('/most-played').get(protect, getMostPlayedGame);
router.route('/comments').get(protect, getUserComments);
router.route('/dashboard').get(protect, getUserDashboard);
router.route('/page').get(protect, getUserPage);

// Admin routes
router.route('/')
  .get(protect, admin, getUsers);

router.route('/:id')
  .delete(protect, admin, deleteUser)
  .put(protect, admin, updateUser);

module.exports = router;