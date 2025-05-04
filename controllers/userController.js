const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const Product = require('../models/Product');
const mongoose = require('mongoose');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/users
// @access  Public
const registerUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Check for user
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;

      if (req.body.password) {
        user.password = req.body.password;
      }

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        isAdmin: updatedUser.isAdmin,
        token: generateToken(updatedUser._id),
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
const getUsers = async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get all products where this user has left a review or comment
    const productsWithUserInteraction = await Product.find({
      'reviews.user': new mongoose.Types.ObjectId(userId)
    });

    // For each product, remove this user's reviews and recalculate ratings
    for (const product of productsWithUserInteraction) {
      // Remove user's reviews
      product.reviews = product.reviews.filter(
        review => review.user.toString() !== userId.toString()
      );
      
      // Update review count
      product.numReviews = product.reviews.length;
      
      // Save the updated product
      await product.save();
      
      // Recalculate the weighted rating for this product
      await updateWeightedProductRating(product._id.toString());
    }

    // Delete the user
    await user.deleteOne();
    
    res.json({ message: 'User removed successfully and all associated data cleaned up' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Helper function to calculate and update weighted product rating
// Copy from productController.js for reference - make sure it's consistent
async function updateWeightedProductRating(productId) {
  try {
    const product = await Product.findById(productId);

    if (!product) {
      console.error(`Product not found for rating update: ${productId}`);
      return;
    }

    // Find all users who have played this game
    const usersWhoPlayed = await User.find({ 'playTime.product': productId });

    if (!usersWhoPlayed || usersWhoPlayed.length === 0) {
      product.rating = 0; // No playtime, rating is 0
      await product.save();
      return;
    }

    let weightedSum = 0;
    let totalPlayTime = 0;

    // Calculate total playtime for this game across all users
    usersWhoPlayed.forEach(user => {
      const gamePlayData = user.playTime.find(pt => pt.product.toString() === productId.toString());
      if (gamePlayData) {
        totalPlayTime += gamePlayData.time;
      }
    });

    // Calculate weighted sum from reviews, considering only users who have played
    if (product.reviews && product.reviews.length > 0) {
      for (const review of product.reviews) {
        // Find the playtime for the user who wrote the review
        const reviewingUser = usersWhoPlayed.find(u => u._id.toString() === review.user.toString());
        if (reviewingUser) {
          const gamePlayData = reviewingUser.playTime.find(pt => pt.product.toString() === productId.toString());
          if (gamePlayData && gamePlayData.time > 0 && review.rating > 0) {
            weightedSum += gamePlayData.time * review.rating;
          }
        }
      }
    }

    // Update product rating (handle division by zero)
    product.rating = totalPlayTime > 0 ? weightedSum / totalPlayTime : 0;

    await product.save();
  } catch (error) {
    console.error(`Error updating weighted rating for product ${productId}:`, error);
  }
}

// @desc    Update user by ID (Admin)
// @route   PUT /api/users/:id
// @access  Private/Admin
const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      // Only allow admins to change the isAdmin status
      user.isAdmin = req.body.isAdmin === undefined ? user.isAdmin : req.body.isAdmin;

      // Allow updating other fields if needed (optional)
      // user.playTime = req.body.playTime === undefined ? user.playTime : req.body.playTime;
      // user.rating = req.body.rating === undefined ? user.rating : req.body.rating;
      // Note: Handling comments array updates might require more specific logic

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        isAdmin: updatedUser.isAdmin,
        playTime: updatedUser.playTime,
        comments: updatedUser.comments,
        rating: updatedUser.rating,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    // Handle potential duplicate email errors if email is updated
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get user statistics (average rating, total playtime)
// @route   GET /api/users/stats
// @access  Private
const getUserStats = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get the user with playtime data
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Calculate total playtime across all games
    const totalPlayTime = user.playTime.reduce((total, game) => total + game.time, 0);
    
    // Get all products where this user has left a review
    const productsWithUserReviews = await Product.find({
      'reviews.user': new mongoose.Types.ObjectId(userId)
    });
    
    // Extract user's ratings
    let totalRating = 0;
    let ratingCount = 0;
    
    productsWithUserReviews.forEach(product => {
      const userReview = product.reviews.find(
        review => review.user.toString() === userId.toString()
      );
      
      if (userReview && userReview.rating) {
        totalRating += userReview.rating;
        ratingCount++;
      }
    });
    
    // Calculate average rating
    const averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;
    
    res.json({
      totalPlayTime,
      averageRating,
      ratingCount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get user's most played game
// @route   GET /api/users/most-played
// @access  Private
const getMostPlayedGame = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get the user with playtime data
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (!user.playTime || user.playTime.length === 0) {
      return res.status(404).json({ message: 'No games played yet' });
    }
    
    // Find the game with maximum playtime
    let maxPlayTime = 0;
    let mostPlayedGameId = null;
    
    user.playTime.forEach(game => {
      if (game.time > maxPlayTime) {
        maxPlayTime = game.time;
        mostPlayedGameId = game.product;
      }
    });
    
    if (!mostPlayedGameId) {
      return res.status(404).json({ message: 'No games played yet' });
    }
    
    // Get the most played game details
    const mostPlayedGame = await Product.findById(mostPlayedGameId);
    
    if (!mostPlayedGame) {
      return res.status(404).json({ message: 'Game not found' });
    }
    
    res.json({
      game: {
        _id: mostPlayedGame._id,
        name: mostPlayedGame.name,
        image: mostPlayedGame.image,
        category: mostPlayedGame.category,
        brand: mostPlayedGame.brand,
      },
      playTime: maxPlayTime
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get user's comments sorted by playtime
// @route   GET /api/users/comments
// @access  Private
const getUserComments = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get the user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get all products where this user has left a comment
    const products = await Product.find({
      'reviews.user': new mongoose.Types.ObjectId(userId),
      'reviews.comment': { $exists: true, $ne: '' }
    });
    
    // Extract comments and associate them with playtime
    const comments = [];
    
    products.forEach(product => {
      const userReview = product.reviews.find(
        review => review.user.toString() === userId.toString() && review.comment
      );
      
      if (userReview) {
        // Find playtime for this game
        const playTimeEntry = user.playTime.find(
          pt => pt.product.toString() === product._id.toString()
        );
        
        const playTime = playTimeEntry ? playTimeEntry.time : 0;
        
        comments.push({
          gameId: product._id,
          gameName: product.name,
          comment: userReview.comment,
          playTime: playTime,
          rating: userReview.rating,
          createdAt: userReview.createdAt
        });
      }
    });
    
    // Sort by playtime (descending)
    comments.sort((a, b) => b.playTime - a.playTime);
    
    res.json(comments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get user dashboard (comprehensive info)
// @route   GET /api/users/dashboard
// @access  Private
const getUserDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get the user with playtime data
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // 1. Calculate total playtime across all games
    const totalPlayTime = user.playTime.reduce((total, game) => total + game.time, 0);
    
    // 2. Find most played game
    let mostPlayedGame = null;
    let maxPlayTime = 0;
    
    if (user.playTime && user.playTime.length > 0) {
      // Find game with max playtime
      for (const game of user.playTime) {
        if (game.time > maxPlayTime) {
          maxPlayTime = game.time;
          mostPlayedGame = game.product;
        }
      }
      
      // Get details of most played game if exists
      if (mostPlayedGame) {
        mostPlayedGame = await Product.findById(mostPlayedGame).select('_id name image category brand');
      }
    }
    
    // 3. Get all products where this user has left a review
    const productsWithUserReviews = await Product.find({
      'reviews.user': new mongoose.Types.ObjectId(userId)
    });
    
    // 4. Calculate average rating
    let totalRating = 0;
    let ratingCount = 0;
    
    productsWithUserReviews.forEach(product => {
      const userReview = product.reviews.find(
        review => review.user.toString() === userId.toString()
      );
      
      if (userReview && userReview.rating) {
        totalRating += userReview.rating;
        ratingCount++;
      }
    });
    
    const averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;
    
    // 5. Get all user comments with game info
    const comments = [];
    
    for (const product of productsWithUserReviews) {
      const userReview = product.reviews.find(
        review => review.user.toString() === userId.toString() && review.comment
      );
      
      if (userReview && userReview.comment) {
        // Find playtime for this game
        const playTimeEntry = user.playTime.find(
          pt => pt.product.toString() === product._id.toString()
        );
        
        const playTime = playTimeEntry ? playTimeEntry.time : 0;
        
        comments.push({
          gameId: product._id,
          gameName: product.name,
          gameImage: product.image,
          category: product.category,
          comment: userReview.comment,
          playTime,
          rating: userReview.rating,
          createdAt: userReview.createdAt
        });
      }
    }
    
    // Sort comments by playtime (descending)
    comments.sort((a, b) => b.playTime - a.playTime);
    
    // 6. Get all games the user has played
    const playedGames = [];
    
    for (const playTime of user.playTime) {
      const product = await Product.findById(playTime.product).select('_id name image category brand rating');
      
      if (product) {
        playedGames.push({
          game: product,
          playTime: playTime.time
        });
      }
    }
    
    // Sort played games by playtime (descending)
    playedGames.sort((a, b) => b.playTime - a.playTime);
    
    // Return comprehensive dashboard data
    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email
      },
      stats: {
        totalPlayTime,
        averageRating,
        ratingCount,
        gamesPlayedCount: user.playTime.length,
        commentsCount: comments.length
      },
      mostPlayedGame: mostPlayedGame ? {
        game: mostPlayedGame,
        playTime: maxPlayTime
      } : null,
      comments,
      playedGames
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get complete user page data
// @route   GET /api/users/page
// @access  Private
const getUserPage = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Calculate average rating given by the user
    let averageRating = 0;
    let ratingCount = 0;
    
    // Find all products rated by this user
    const productsRated = await Product.find({ 'reviews.user': user._id })
      .select('reviews');
    
    // Calculate user's average rating
    productsRated.forEach(product => {
      const userReview = product.reviews.find(review => 
        review.user.toString() === user._id.toString()
      );
      
      if (userReview && userReview.rating) {
        averageRating += userReview.rating;
        ratingCount++;
      }
    });
    
    averageRating = ratingCount > 0 ? averageRating / ratingCount : 0;
    
    // Calculate total play time
    let totalPlayTime = 0;
    user.playTime.forEach(pt => {
      totalPlayTime += pt.time;
    });
    
    // Find most played game
    let mostPlayedGame = null;
    let maxPlayTime = 0;
    
    if (user.playTime.length > 0) {
      // Sort playtime in descending order
      const sortedPlayTime = [...user.playTime].sort((a, b) => b.time - a.time);
      
      if (sortedPlayTime.length > 0 && sortedPlayTime[0].time > 0) {
        const gameId = sortedPlayTime[0].product;
        const game = await Product.findById(gameId).select('_id name image category');
        
        if (game) {
          mostPlayedGame = {
            _id: game._id,
            name: game.name,
            image: game.image,
            category: game.category,
            playTime: sortedPlayTime[0].time
          };
          maxPlayTime = sortedPlayTime[0].time;
        }
      }
    }
    
    // Get user's comments sorted by playtime
    const userComments = [];
    
    // Find all games that the user has commented on
    for (const pt of user.playTime) {
      const game = await Product.findById(pt.product).select('_id name image category reviews');
      
      if (game) {
        const userReview = game.reviews.find(review => 
          review.user.toString() === user._id.toString()
        );
        
        if (userReview && userReview.comment) {
          userComments.push({
            gameId: game._id,
            gameName: game.name,
            gameImage: game.image,
            category: game.category,
            comment: userReview.comment,
            playTime: pt.time,
            rating: userReview.rating,
            createdAt: userReview.createdAt
          });
        }
      }
    }
    
    // Sort comments by playtime (descending)
    userComments.sort((a, b) => b.playTime - a.playTime);
    
    // Return complete user page data
    res.json({
      userName: user.name,
      averageRating,
      totalPlayTime,
      mostPlayedGame,
      comments: userComments
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
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
};