const mongoose = require('mongoose');

const reviewSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    name: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
    },
    comment: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const productSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    name: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    brand: {
      type: String,
      required: true,
    },
    category: {
      type: [String],
      required: true,
      validate: [
        {
          validator: function(value) {
            return value && value.length > 0 && value.length <= 5;
          },
          message: 'Category must have between 1 and 5 genres'
        }
      ]
    },
    description: {
      type: String,
      required: true,
    },
    reviews: [reviewSchema],
    rating: {
      type: Number,
      required: true,
      default: 0,
    },
    numReviews: {
      type: Number,
      required: true,
      default: 0,
    },
    disableRating: {
      type: Boolean,
      default: false, // Admin control to disable reviews/ratings for this product
    },
    disableCommenting: {
      type: Boolean,
      default: false, // Admin control to disable commenting for this product
    },
    // Allow for additional optional fields through schema flexibility
  },
  {
    timestamps: true,
    strict: false // Allow additional fields beyond the schema definition
  }
);

const Product = mongoose.model('Product', productSchema);

module.exports = Product;