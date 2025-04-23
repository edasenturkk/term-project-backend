const express = require('express');
const { check } = require('express-validator');
const router = express.Router();
const {
  getProducts,
  getProductById,
  deleteProduct,
  createProduct,
  updateProduct,
  addOrUpdateProductReview,
  playGame,
  getDetailedProducts,
  getProductComments
} = require('../controllers/productController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public routes
router.route('/').get(getProducts);
router.route('/detailed').get(getDetailedProducts);
router.route('/:id').get(getProductById);
router.route('/:id/comments').get(getProductComments);

// Private routes
router.route('/:id/reviews').post(
  protect,
  [
    // Validation updated: rating optional, comment optional, but need at least one?
    // Let controller handle validation for now. Rating 1-5 check in controller.
    // check('rating', 'Rating must be between 1 and 5').optional().isInt({ min: 1, max: 5 }),
    // check('comment', 'Comment must be a string').optional().isString()
  ],
  addOrUpdateProductReview
);

router.route('/:id/play').post(
  protect,
  [
    check('time', 'Playtime in minutes is required').isNumeric().isInt({ min: 1 })
  ],
  playGame
);

// Admin routes
router
  .route('/')
  .post(
    protect,
    admin,
    [
      check('name', 'Name is required').not().isEmpty(),
      check('description', 'Description is required').not().isEmpty(),
      check('image', 'Image is required').not().isEmpty(),
      check('brand', 'Developer name is required').not().isEmpty(),
      check('category', 'Genre is required').isArray({ min: 1, max: 5 }),
    ],
    createProduct
  );

router
  .route('/:id')
  .delete(protect, admin, deleteProduct)
  .put(
    protect,
    admin,
    [
      check('name', 'Name is required').not().isEmpty(),
      check('description', 'Description is required').not().isEmpty(),
      check('image', 'Image is required').not().isEmpty(),
      check('brand', 'Developer name is required').not().isEmpty(),
      check('category', 'Genre is required').optional().isArray({ min: 1, max: 5 }),
    ],
    updateProduct
  );

module.exports = router;