const { validationResult } = require('express-validator');
const Product = require('../models/Product');
const User = require('../models/User');
const mongoose = require('mongoose');

// Helper function to calculate and update weighted product rating
async function updateWeightedProductRating(productId) {
  try {
    const product = await Product.findById(productId).populate('reviews.user', 'playTime'); // Get reviews and associated users' playtime

    if (!product) {
      console.error(`Product not found for rating update: ${productId}`);
      return;
    }

    let weightedSum = 0;
    let totalPlayTime = 0;

    // Find all users who have played this game
    const usersWhoPlayed = await User.find({ 'playTime.product': productId });

    if (!usersWhoPlayed || usersWhoPlayed.length === 0) {
      product.rating = 0; // No playtime, rating is 0
      await product.save();
      return;
    }

    // Calculate total playtime for this game across all users
    usersWhoPlayed.forEach(user => {
      const gamePlayData = user.playTime.find(pt => pt.product.toString() === productId.toString());
      if (gamePlayData) {
        totalPlayTime += gamePlayData.time;
      }
    });

    // Calculate weighted sum from reviews, considering only users who have played
    if (product.reviews && product.reviews.length > 0) {
      product.reviews.forEach(review => {
        // Find the playtime for the user who wrote the review
        const reviewingUser = usersWhoPlayed.find(u => u._id.toString() === review.user._id.toString());
        if (reviewingUser) {
            const gamePlayData = reviewingUser.playTime.find(pt => pt.product.toString() === productId.toString());
            if (gamePlayData && gamePlayData.time > 0 && review.rating > 0) {
                weightedSum += gamePlayData.time * review.rating;
            }
        }
      });
    }

    // Update product rating (handle division by zero)
    product.rating = totalPlayTime > 0 ? weightedSum / totalPlayTime : 0;

    await product.save();
    console.log(`Updated weighted rating for product ${productId} to ${product.rating}`);

  } catch (error) {
    console.error(`Error updating weighted rating for product ${productId}:`, error);
  }
}

// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
  try {
    const pageSize = 10;
    const page = Number(req.query.pageNumber) || 1;

    const keyword = req.query.keyword
      ? {
          name: {
            $regex: req.query.keyword,
            $options: 'i',
          },
        }
      : {};

    const count = await Product.countDocuments({ ...keyword });
    const products = await Product.find({ ...keyword })
      .limit(pageSize)
      .skip(pageSize * (page - 1));

    res.json({ products, page, pages: Math.ceil(count / pageSize) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('reviews.user', 'name email'); // Populate basic user info for reviews

    if (product) {
      // Sort reviews by user playtime for this specific product (descending)
      if (product.reviews && product.reviews.length > 0) {
        const userIds = [...new Set(product.reviews.map(review => review.user._id.toString()))];

        // Fetch playtime data for users who reviewed
        const usersWithPlaytime = await User.find({ 
          _id: { $in: userIds },
          'playTime.product': product._id 
        }).select('_id playTime.product playTime.time'); // Select only necessary fields

        // Create a map for quick lookup: userId -> playtimeForThisProduct
        const playtimeMap = usersWithPlaytime.reduce((map, user) => {
          const ptEntry = user.playTime.find(pt => pt.product.toString() === product._id.toString());
          map[user._id.toString()] = ptEntry ? ptEntry.time : 0;
          return map;
        }, {});

        // Sort reviews
        product.reviews.sort((a, b) => {
          const playtimeA = playtimeMap[a.user._id.toString()] || 0;
          const playtimeB = playtimeMap[b.user._id.toString()] || 0;
          return playtimeB - playtimeA; // Descending order
        });
      }

      res.json(product);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Find all users who have play time records for this game
    const usersWithPlaytime = await User.find({
      'playTime.product': mongoose.Types.ObjectId(productId)
    });
    
    // Update each user's play time records by removing this game
    for (const user of usersWithPlaytime) {
      // Filter out the play time entry for this product
      user.playTime = user.playTime.filter(
        pt => pt.product.toString() !== productId.toString()
      );
      
      // Save the updated user
      await user.save();
    }

    // Delete the product
    await product.deleteOne();
    
    res.json({ 
      message: 'Product removed successfully and all associated user data cleaned up',
      affectedUsers: usersWithPlaytime.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      name, 
      description, 
      image, 
      brand, 
      category, 
      disableRating, 
      disableCommenting,
      ...otherFields // Captures any additional optional fields
    } = req.body;

    // Validate category is an array with 1-5 elements
    if (!Array.isArray(category) || category.length < 1 || category.length > 5) {
      return res.status(400).json({ 
        message: 'Category must be an array with 1-5 genres' 
      });
    }

    // Process image
    let processedImage = image;
    
    // Check if image is a base64 string (from file upload)
    if (image && image.startsWith('data:image')) {
      // Validate image format (must be PNG or JPG/JPEG)
      const isValidFormat = 
        image.startsWith('data:image/png;base64,') || 
        image.startsWith('data:image/jpeg;base64,') || 
        image.startsWith('data:image/jpg;base64,');
        
      if (!isValidFormat) {
        return res.status(400).json({
          message: 'Image must be PNG or JPG/JPEG format'
        });
      }
      
      // Image is already base64 encoded from the client
      processedImage = image;
    } else if (!image) {
      return res.status(400).json({
        message: 'Image is required'
      });
    }

    const product = new Product({
      name,
      user: req.user._id,
      image: processedImage,
      brand, // Developer name
      category, // Array of genres
      description,
      numReviews: 0,
      rating: 0, // Initial rating is 0
      disableRating: disableRating === undefined ? false : Boolean(disableRating),
      disableCommenting: disableCommenting === undefined ? false : Boolean(disableCommenting),
      ...otherFields // Add any additional fields provided (optional fields)
    });

    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      name, 
      description, 
      image, 
      brand, 
      category, 
      disableRating, 
      disableCommenting,
      ...otherFields 
    } = req.body;
    
    // Validate category if provided
    if (category !== undefined) {
      if (!Array.isArray(category) || category.length < 1 || category.length > 5) {
        return res.status(400).json({ 
          message: 'Category must be an array with 1-5 genres' 
        });
      }
    }

    // Process image if provided
    let processedImage = image;
    if (image && image.startsWith('data:image')) {
      // Validate image format (must be PNG or JPG/JPEG)
      const isValidFormat = 
        image.startsWith('data:image/png;base64,') || 
        image.startsWith('data:image/jpeg;base64,') || 
        image.startsWith('data:image/jpg;base64,');
        
      if (!isValidFormat) {
        return res.status(400).json({
          message: 'Image must be PNG or JPG/JPEG format'
        });
      }
      
      // Image is already base64 encoded from the client
      processedImage = image;
    }

    const productId = req.params.id;

    const product = await Product.findById(productId);

    if (product) {
      // Update required fields
      product.name = name || product.name;
      product.description = description || product.description;
      product.image = processedImage || product.image;
      product.brand = brand || product.brand; // Developer name
      product.category = category || product.category; // Genre array

      // Update disable flags if provided
      if (disableRating !== undefined) {
        product.disableRating = Boolean(disableRating);
      }
      if (disableCommenting !== undefined) {
        product.disableCommenting = Boolean(disableCommenting);
      }

      // Update any optional fields
      for (const [key, value] of Object.entries(otherFields)) {
        product[key] = value;
      }

      const updatedProduct = await product.save();
      
      // Note: Updating disableRating might affect weighted average, but the calculation
      // itself doesn't need immediate re-triggering unless reviews are added/removed/changed.

      res.json(updatedProduct);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Add or Update product review (rating and/or comment)
// @route   POST /api/products/:id/reviews
// @access  Private
const addOrUpdateProductReview = async (req, res) => {
  const { rating, comment } = req.body;
  const productId = req.params.id;
  const userId = req.user._id;

  // Basic validation: at least one of rating or comment must be provided
  if (rating === undefined && comment === undefined) {
    return res.status(400).json({ message: 'Rating or comment is required' });
  }

  // Validate rating if provided
  const numericRating = rating !== undefined ? Number(rating) : undefined;
  if (numericRating !== undefined && (numericRating < 1 || numericRating > 5)) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5' });
  }

  try {
    const product = await Product.findById(productId);
    const user = await User.findById(userId);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    if (!user) {
      return res.status(404).json({ message: 'User not found' }); // Should not happen if protect middleware works
    }

    // Prerequisite check: Playtime >= 1 hour (assuming 60 minutes)
    const playTimeData = user.playTime.find(pt => pt.product.toString() === productId.toString());
    const userPlayTime = playTimeData ? playTimeData.time : 0;
    const requiredPlayTime = 60; // e.g., 60 minutes

    if (userPlayTime < requiredPlayTime) {
      return res.status(403).json({ message: `You must play the game for at least ${requiredPlayTime} minutes to rate or comment.` });
    }

    // Admin disable check
    if (numericRating !== undefined && product.disableRating) {
      return res.status(403).json({ message: 'Rating is disabled for this product by the administrator.' });
    }
    if (comment !== undefined && product.disableCommenting) {
        return res.status(403).json({ message: 'Commenting is disabled for this product by the administrator.' });
    }

    const reviewIndex = product.reviews.findIndex(
      (r) => r.user.toString() === userId.toString()
    );

    let message = 'Review updated';
    if (reviewIndex > -1) {
      // Update existing review
      if (numericRating !== undefined) {
        product.reviews[reviewIndex].rating = numericRating;
      }
      if (comment !== undefined) {
        // Overwrite existing comment
        product.reviews[reviewIndex].comment = comment;
      }
      product.reviews[reviewIndex].name = user.name; // Update name in case it changed
    } else {
      // Add new review
      if (numericRating === undefined && comment === undefined) {
        // This case should technically be caught by the initial check, but good to be safe
        return res.status(400).json({ message: 'Cannot add an empty review. Rating or comment is required.' });
      }
      const newReview = {
        user: userId,
        name: user.name,
        rating: numericRating, // Will be undefined if not provided
        comment: comment,       // Will be undefined if not provided
      };
      product.reviews.push(newReview);
      product.numReviews = product.reviews.length;
      message = 'Review added';
    }

    await product.save();

    // Update weighted rating asynchronously (no need to wait)
    updateWeightedProductRating(productId).catch(err => console.error("Failed to update rating in background:", err));

    res.status(reviewIndex > -1 ? 200 : 201).json({ message });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Play a game
// @route   POST /api/products/:id/play
// @access  Private
const playGame = async (req, res) => {
  try {
    const { time } = req.body;
    const productId = req.params.id;
    const userId = req.user._id;

    // Validate time
    const playTime = Number(time);
    if (!playTime || playTime <= 0) {
      return res.status(400).json({ message: 'Valid playtime value is required' });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Game not found' });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user's playtime for this product
    const playTimeIndex = user.playTime.findIndex(
      (pt) => pt.product.toString() === productId.toString()
    );

    if (playTimeIndex > -1) {
      // Update existing playtime
      user.playTime[playTimeIndex].time += playTime;
    } else {
      // Add new playtime entry
      user.playTime.push({
        product: productId,
        time: playTime
      });
    }

    await user.save();

    // Update weighted rating in background
    updateWeightedProductRating(productId).catch(err => 
      console.error(`Failed to update rating after playtime update: ${err}`)
    );

    // Return updated playtime for this product
    const updatedPlayTime = user.playTime.find(pt => pt.product.toString() === productId.toString());
    
    res.status(200).json({ 
      message: 'Playtime updated successfully',
      playTime: updatedPlayTime.time
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Fetch all products with detailed information
// @route   GET /api/products/detailed
// @access  Public
const getDetailedProducts = async (req, res) => {
  try {
    // Fetch all products
    const products = await Product.find({}).populate('reviews.user', 'name');
    
    // For each product, calculate total playtime and sort reviews by user playtime
    const detailedProducts = await Promise.all(products.map(async (product) => {
      // Find all users who played this game
      const usersWhoPlayed = await User.find({ 'playTime.product': product._id })
        .select('_id name playTime');
      
      // Calculate total playtime
      let totalPlayTime = 0;
      usersWhoPlayed.forEach(user => {
        const gamePlayData = user.playTime.find(pt => pt.product.toString() === product._id.toString());
        if (gamePlayData) {
          totalPlayTime += gamePlayData.time;
        }
      });
      
      // Create a playtime map for each user who left a review
      const userPlaytimeMap = {};
      usersWhoPlayed.forEach(user => {
        const gamePlayData = user.playTime.find(pt => pt.product.toString() === product._id.toString());
        if (gamePlayData) {
          userPlaytimeMap[user._id.toString()] = gamePlayData.time;
        }
      });
      
      // Add userPlayTime to each review and sort by playtime
      const reviewsWithPlaytime = product.reviews.map(review => {
        const userPlayTime = userPlaytimeMap[review.user._id.toString()] || 0;
        return {
          user: {
            _id: review.user._id,
            name: review.user.name
          },
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
          userPlayTime: userPlayTime
        };
      }).sort((a, b) => b.userPlayTime - a.userPlayTime);
      
      // Return product with additional information
      return {
        _id: product._id,
        name: product.name,
        image: product.image,
        brand: product.brand,
        category: product.category,
        description: product.description,
        playTime: totalPlayTime,
        rating: product.rating,
        numReviews: product.numReviews,
        disableRating: product.disableRating,
        disableCommenting: product.disableCommenting,
        reviews: reviewsWithPlaytime,
        // Add any additional fields that are present in the product
        ...Object.keys(product._doc)
          .filter(key => !['_id', 'name', 'image', 'brand', 'category', 'description', 
                           'playTime', 'rating', 'numReviews', 'disableRating', 
                           'disableCommenting', 'reviews', '__v', 'createdAt', 
                           'updatedAt', 'user'].includes(key))
          .reduce((obj, key) => {
            obj[key] = product[key];
            return obj;
          }, {})
      };
    }));
    
    res.json({ games: detailedProducts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Fetch product comments sorted by user playtime
// @route   GET /api/products/:id/comments
// @access  Public
const getProductComments = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('reviews.user', 'name');
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Find all users who played this game
    const usersWhoPlayed = await User.find({ 'playTime.product': product._id })
      .select('_id name playTime');
    
    // Create a playtime map for each user
    const userPlaytimeMap = {};
    usersWhoPlayed.forEach(user => {
      const gamePlayData = user.playTime.find(pt => pt.product.toString() === product._id.toString());
      if (gamePlayData) {
        userPlaytimeMap[user._id.toString()] = gamePlayData.time;
      }
    });
    
    // Add userPlayTime to each review and sort by playtime
    const commentsWithPlaytime = product.reviews.map(review => {
      const userPlayTime = userPlaytimeMap[review.user._id.toString()] || 0;
      return {
        user: {
          _id: review.user._id,
          name: review.user.name
        },
        comment: review.comment,
        rating: review.rating,
        userPlayTime: userPlayTime,
        createdAt: review.createdAt
      };
    }).sort((a, b) => b.userPlayTime - a.userPlayTime);
    
    res.json({
      gameId: product._id,
      gameName: product.name,
      comments: commentsWithPlaytime
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getProducts,
  getProductById,
  deleteProduct,
  createProduct,
  updateProduct,
  addOrUpdateProductReview,
  playGame,
  getDetailedProducts,
  getProductComments
};