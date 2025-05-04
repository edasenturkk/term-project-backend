const mongoose = require('mongoose');
const dotenv = require('dotenv');
const colors = require('colors'); // Optional: for colored console output
const User = require('./models/User');
const Product = require('./models/Product');
const connectDB = require('./config/db');
// Import helper (or replicate logic) if needed for weighted rating calculation
// const { updateWeightedProductRating } = require('./controllers/productController'); // Assuming export

dotenv.config();

// --- Sample Data ---

const sampleUsers = [
  { name: 'Admin User', email: 'admin@example.com', password: 'password123', isAdmin: true },
  { name: 'Alice Wonderland', email: 'alice@example.com', password: 'password123' },
  { name: 'Bob The Builder', email: 'bob@example.com', password: 'password123' },
  { name: 'Charlie Chaplin', email: 'charlie@example.com', password: 'password123' },
  { name: 'Diana Prince', email: 'diana@example.com', password: 'password123' },
  { name: 'Ethan Hunt', email: 'ethan@example.com', password: 'password123' },
  { name: 'Fiona Shrek', email: 'fiona@example.com', password: 'password123' },
  { name: 'George Jetson', email: 'george@example.com', password: 'password123' },
  { name: 'Hannah Montana', email: 'hannah@example.com', password: 'password123' },
  { name: 'Ian Malcolm', email: 'ian@example.com', password: 'password123' },
  { name: 'Jane Doe', email: 'jane@example.com', password: 'password123' }, // 11 users
];

const sampleProducts = [
  {
    name: 'Cyber Odyssey',
    image: 'https://loremflickr.com/320/240/cyberpunk,rpg?random=1', // Updated
    brand: 'Neon Dreams Studio',
    category: ['RPG', 'Sci-Fi', 'Open World'],
    description: 'Explore a vast cyberpunk city, upgrade your augments, and unravel a corporate conspiracy.',
    releaseDate: '2024-10-20', // Optional
    developer: 'Neon Dreams Dev Team', // Optional
  },
  {
    name: 'Pixel Racers Turbo',
    image: 'https://loremflickr.com/320/240/racing,arcade?random=2', // Updated
    brand: 'RetroRev Games',
    category: ['Racing', 'Arcade'],
    description: 'High-octane retro racing with power-ups and crazy tracks.',
    platform: ['PC', 'Console'], // Optional
  },
  {
    name: 'Mystic Forest Chronicles',
    image: 'https://loremflickr.com/320/240/fantasy,puzzle?random=3', // Updated
    brand: 'Enchanted Pixels',
    category: ['Adventure', 'Puzzle', 'Fantasy'],
    description: 'Solve ancient puzzles and navigate a magical forest to lift a curse.',
    voiceActing: true, // Optional
  },
  {
    name: 'Galactic Command',
    image: 'https://loremflickr.com/320/240/strategy,space?random=4', // Updated
    brand: 'Stellar Forge Inc.',
    category: ['Strategy', 'Sci-Fi', '4X'],
    description: 'Lead your civilization to galactic dominance through diplomacy, warfare, and exploration.',
  },
  {
    name: 'Zombie Survival Pro',
    image: 'https://loremflickr.com/320/240/zombie,survival?random=5', // Updated
    brand: 'Apocalypse Interactive',
    category: ['Survival', 'Horror', 'Action'],
    description: 'Scavenge, build, and survive against hordes of the undead.',
  },
  {
    name: 'Cooking Mania Deluxe',
    image: 'https://loremflickr.com/320/240/cooking,simulation?random=6', // Updated
    brand: 'Culinary Coders',
    category: ['Simulation', 'Casual'],
    description: 'Run your own restaurant and become a master chef.',
  },
  {
    name: 'Stealth Ops: Shadow Protocol',
    image: 'https://loremflickr.com/320/240/stealth,action?random=7', // Updated
    brand: 'Ghost Works',
    category: ['Stealth', 'Action'],
    description: 'Infiltrate enemy bases using gadgets and cunning.',
  },
  {
    name: 'Fantasy Football Manager 2025',
    image: 'https://loremflickr.com/320/240/football,manager?random=8', // Updated
    brand: 'SportSim Studios',
    category: ['Simulation', 'Sports', 'Management'],
    description: 'Manage your fantasy football team to victory.',
  },
  {
    name: "Platformer Pete's Big Jump", // Escaped the apostrophe
    image: 'https://loremflickr.com/320/240/platformer,indie?random=9', // Updated
    brand: 'JumpJoy Creations',
    category: ['Platformer', 'Indie'],
    description: 'Classic platforming action with challenging levels.'
  },
  {
    name: 'Detective Noir: The Rainy City Case',
    image: 'https://loremflickr.com/320/240/detective,noir?random=10', // Updated
    brand: 'Shadowplay Games',
    category: ['Adventure', 'Point-and-Click', 'Mystery'],
    description: 'Solve a complex murder case in a rain-soaked city.',
    soundtrackIncluded: true, // Optional
  },
  {
    name: 'Arena Fighters Ultimate',
    image: 'https://loremflickr.com/320/240/fighting,arena?random=11', // Updated
    brand: 'Combat Kings',
    category: ['Fighting', 'Action'],
    description: 'Choose your fighter and battle in intense arena combat.',
  } // 11 games
];

// Helper function to simulate interactions
const simulateInteraction = async (user, product, time, rating, comment) => {
  if (!user || !product) return;

  // Simulate Playtime (always add playtime)
  const playTimeIndex = user.playTime.findIndex(pt => pt.product.toString() === product._id.toString());
  if (playTimeIndex > -1) {
    user.playTime[playTimeIndex].time += time;
  } else {
    user.playTime.push({ product: product._id, time: time });
  }
  await user.save(); // Save user playtime update

  // Simulate Rating/Comment (only if time >= 60 mins)
  if (time >= 60) {
    const reviewIndex = product.reviews.findIndex(r => r.user.toString() === user._id.toString());
    let reviewUpdated = false;

    if (reviewIndex > -1) {
      // Update existing review
      if (rating !== undefined && !product.disableRating) {
        product.reviews[reviewIndex].rating = rating;
        reviewUpdated = true;
      }
      if (comment !== undefined && !product.disableCommenting) {
        product.reviews[reviewIndex].comment = comment;
        reviewUpdated = true;
      }
      if(reviewUpdated) product.reviews[reviewIndex].name = user.name; // Update name if changed
    } else {
      // Add new review if rating or comment provided and not disabled
      const canRate = rating !== undefined && !product.disableRating;
      const canComment = comment !== undefined && !product.disableCommenting;

      if (canRate || canComment) {
        const newReview = {
          user: user._id,
          name: user.name,
          rating: canRate ? rating : undefined,
          comment: canComment ? comment : undefined,
        };
        product.reviews.push(newReview);
        reviewUpdated = true;
      }
    }

    if (reviewUpdated) {
      product.numReviews = product.reviews.length; // Update review count
      // Weighted rating will be calculated later
      await product.save(); // Save product review update
      console.log(`Simulated interaction: ${user.name} -> ${product.name} (Time: ${time}, Rating: ${rating}, Comment: ${comment ? 'Yes' : 'No'})`.cyan);
    }
  }
};

// Helper function to calculate and update weighted product rating (replicated from controller)
async function updateWeightedProductRatingInSeeder(productId, allUsers, allProducts) {
  try {
    const product = allProducts.find(p => p._id.toString() === productId.toString());
    if (!product) return;

    let weightedSum = 0;
    let totalPlayTime = 0;

    // Find users who played this game from the createdUsers list
    const usersWhoPlayed = allUsers.filter(user =>
      user.playTime.some(pt => pt.product.toString() === productId.toString())
    );

    if (!usersWhoPlayed || usersWhoPlayed.length === 0) {
      product.rating = 0;
      await product.save();
      return;
    }

    // Calculate total playtime and weighted sum
    usersWhoPlayed.forEach(user => {
      const gamePlayData = user.playTime.find(pt => pt.product.toString() === productId.toString());
      if (gamePlayData) {
        totalPlayTime += gamePlayData.time;

        // Check if this user reviewed the game
        const review = product.reviews.find(r => r.user.toString() === user._id.toString());
        if (review && review.rating > 0 && gamePlayData.time > 0) {
          weightedSum += gamePlayData.time * review.rating;
        }
      }
    });

    // Update product rating
    product.rating = totalPlayTime > 0 ? weightedSum / totalPlayTime : 0;
    await product.save();
    console.log(`Calculated weighted rating for ${product.name}: ${product.rating}`.yellow);

  } catch (error) {
    console.error(`Error updating weighted rating for product ${productId} in seeder:`, error);
  }
}


// --- Seeder Functions ---

const importData = async () => {
  await connectDB(); // Connect using your db.js logic

  try {
    // Clear existing data
    await Product.deleteMany();
    await User.deleteMany();
    console.log('Data Cleared!'.red.inverse);

    // Insert users individually to trigger pre-save hook for password hashing
    const createdUsers = [];
    for (const userData of sampleUsers) {
      const user = await User.create(userData); // Use create() instead of insertMany()
      createdUsers.push(user);
    }
    console.log(`${createdUsers.length} Users Imported!`.green.inverse);

    // Get the admin user
    const adminUser = createdUsers.find((user) => user.isAdmin);
    const productOwnerId = adminUser ? adminUser._id : createdUsers[0]._id; // Fallback to first user

    // Add the owner user ID to each sample product
    const productsWithOwner = sampleProducts.map((product) => {
      return { ...product, user: productOwnerId };
    });

    // Insert products
    let createdProducts = await Product.insertMany(productsWithOwner);
    console.log(`${createdProducts.length} Products Imported!`.green.inverse);

    // --- Simulate Interactions ---
    // Find users and products for simulation
    const alice = createdUsers.find(u => u.email === 'alice@example.com');
    const bob = createdUsers.find(u => u.email === 'bob@example.com');
    const charlie = createdUsers.find(u => u.email === 'charlie@example.com');
    const diana = createdUsers.find(u => u.email === 'diana@example.com');
    const ethan = createdUsers.find(u => u.email === 'ethan@example.com');

    const cyberOdyssey = createdProducts.find(p => p.name === 'Cyber Odyssey');
    const pixelRacers = createdProducts.find(p => p.name === 'Pixel Racers Turbo');
    const mysticForest = createdProducts.find(p => p.name === 'Mystic Forest Chronicles');
    const galacticCommand = createdProducts.find(p => p.name === 'Galactic Command');
    const zombieSurvival = createdProducts.find(p => p.name === 'Zombie Survival Pro');
    const cookingMania = createdProducts.find(p => p.name === 'Cooking Mania Deluxe');
    const stealthOps = createdProducts.find(p => p.name === 'Stealth Ops: Shadow Protocol');

    // Alice: Play 4, Rate 2, Comment 2
    await simulateInteraction(alice, cyberOdyssey, 120, 5, 'Amazing open world!');
    await simulateInteraction(alice, pixelRacers, 70, 4, 'Fun retro racer.');
    await simulateInteraction(alice, mysticForest, 90, undefined, undefined); // Played only
    await simulateInteraction(alice, galacticCommand, 150, undefined, undefined); // Played only

    // Bob: Play 4, Rate 3, Comment 2
    await simulateInteraction(bob, cyberOdyssey, 80, 4, 'Solid RPG mechanics.');
    await simulateInteraction(bob, zombieSurvival, 200, 5, 'Intense survival!');
    await simulateInteraction(bob, cookingMania, 65, 3, undefined); // Played & Rated
    await simulateInteraction(bob, stealthOps, 110, undefined, undefined); // Played only

    // Charlie: Play 4, Rate 2, Comment 3
    await simulateInteraction(charlie, mysticForest, 180, 5, 'Beautiful game, loved the puzzles.');
    await simulateInteraction(charlie, galacticCommand, 250, 4, 'Deep strategy, very engaging.');
    await simulateInteraction(charlie, pixelRacers, 95, 3, 'A bit repetitive.');
    await simulateInteraction(charlie, zombieSurvival, 75, undefined, undefined); // Played only

    // Diana: Play 2, Rate 1, Comment 1
    await simulateInteraction(diana, cookingMania, 130, 4, 'Cute and addictive.');
    await simulateInteraction(diana, stealthOps, 85, undefined, undefined); // Played only

    // Ethan: Play 1, Rate 1, Comment 0
    await simulateInteraction(ethan, cyberOdyssey, 60, 3, undefined); // Played & Rated

    // --- Recalculate Weighted Ratings ---
    // Fetch updated products after interactions
    createdProducts = await Product.find({});
    // Fetch updated users after interactions
    const updatedUsers = await User.find({});

    console.log('Recalculating weighted ratings for all products...'.yellow);
    for (const product of createdProducts) {
      await updateWeightedProductRatingInSeeder(product._id, updatedUsers, createdProducts);
    }

    // --- Verification (Optional) ---
    console.log('Verifying interaction counts...'.magenta);
    let usersMeetingCriteria = 0;
    for (const user of updatedUsers) {
        const playedGames = user.playTime.length;
        const ratedGames = await Product.countDocuments({ 'reviews.user': user._id, 'reviews.rating': { $exists: true } });
        const commentedGames = await Product.countDocuments({ 'reviews.user': user._id, 'reviews.comment': { $exists: true, $ne: '' } });

        if (playedGames > 3 && ratedGames >= 2 && commentedGames >= 2) {
            usersMeetingCriteria++;
            console.log(`${user.name} meets criteria: Played ${playedGames}, Rated ${ratedGames}, Commented ${commentedGames}`.green);
        } else {
             console.log(`${user.name}: Played ${playedGames}, Rated ${ratedGames}, Commented ${commentedGames}`.grey);
        }
    }
    console.log(`Total users meeting criteria (Played >3, Rated >=2, Commented >=2): ${usersMeetingCriteria}`.magenta.inverse);
    if (usersMeetingCriteria < 3) {
        console.warn('Warning: Fewer than 3 users meet the interaction criteria!'.yellow.bold);
    }


    console.log('Data Import Complete!'.green.inverse);
    process.exit();
  } catch (error) {
    console.error(`Error importing data: ${error}`.red.inverse);
    console.error(error.stack); // Log stack trace for detailed debugging
    process.exit(1);
  }
};

const destroyData = async () => {
  await connectDB(); // Connect using your db.js logic

  try {
    await Product.deleteMany();
    await User.deleteMany();

    console.log('Data Destroyed!'.red.inverse);
    process.exit();
  } catch (error) {
    console.error(`Error destroying data: ${error}`.red.inverse);
    process.exit(1);
  }
};

// --- Command Line Execution ---

if (process.argv[2] === '-d') {
  destroyData();
} else {
  importData();
}
