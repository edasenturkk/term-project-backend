# Video Game Distribution Service API

A RESTful API built with Node.js, Express, and MongoDB Atlas for the SENG 454 Cloud Systems and Networks Term Project.

## Features

- User authentication with JWT
- Game management (add, remove, enable/disable rating and comments)
- User management (create, delete)
- Game playing, rating and commenting functionality
- Role-based access control (Admin/User)
- Image upload with base64 encoding (PNG and JPG support)
- User dashboard with comprehensive statistics
- Proper data cleanup when users or games are deleted

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```
PORT=3000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
NODE_ENV=development
```

3. Connect to MongoDB Atlas:
   - Create a MongoDB Atlas account at https://www.mongodb.com/cloud/atlas
   - Set up a cluster and get your connection string
   - Update the MONGODB_URI in your .env file

4. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Authentication

#### Register User
```http
POST /api/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "123456"
}
```

#### Login
```http
POST /api/users/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "123456"
}
```

### Users

#### Get Profile
```http
GET /api/users/profile
Authorization: Bearer {token}
```

#### Get User Statistics
```http
GET /api/users/stats
Authorization: Bearer {token}
```

#### Get User's Most Played Game
```http
GET /api/users/most-played
Authorization: Bearer {token}
```

#### Get User's Comments (Sorted by Playtime)
```http
GET /api/users/comments
Authorization: Bearer {token}
```

#### Get User Dashboard (Comprehensive)
```http
GET /api/users/dashboard
Authorization: Bearer {token}
```
**Response:**
```json
{
  "user": {
    "_id": "user_id",
    "name": "User Name",
    "email": "user@example.com"
  },
  "stats": {
    "totalPlayTime": 540,
    "averageRating": 4.2,
    "ratingCount": 5,
    "gamesPlayedCount": 3,
    "commentsCount": 2
  },
  "mostPlayedGame": {
    "game": {
      "_id": "game_id",
      "name": "Game Name",
      "image": "image_url",
      "category": ["Action", "Adventure"],
      "brand": "Developer Name"
    },
    "playTime": 240
  },
  "comments": [
    {
      "gameId": "game_id",
      "gameName": "Game Name",
      "gameImage": "image_url",
      "category": ["Action", "Adventure"],
      "comment": "Great game!",
      "playTime": 240,
      "rating": 5,
      "createdAt": "2023-04-25T12:00:00.000Z"
    }
  ],
  "playedGames": [
    {
      "game": {
        "_id": "game_id",
        "name": "Game Name",
        "image": "image_url",
        "category": ["Action", "Adventure"],
        "brand": "Developer Name",
        "rating": 4.8
      },
      "playTime": 240
    }
  ]
}
```

#### Update Profile
```http
PUT /api/users/profile
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "John Doe Updated",
  "email": "john@example.com",
  "password": "newpassword"
}
```

#### Get All Users (Admin)
```http
GET /api/users
Authorization: Bearer {token}
```

#### Delete User (Admin)
```http
DELETE /api/users/:id
Authorization: Bearer {token}
```
**Notes:**
- When a user is deleted, all their reviews and comments are removed from games
- Game ratings are recalculated to maintain data integrity

#### Update User (Admin)
```http
PUT /api/users/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Updated Name",
  "email": "updated@example.com",
  "isAdmin": true
}
```

### Games (Products)

#### Get All Games
```http
GET /api/products
```

#### Get Single Game
```http
GET /api/products/:id
```

#### Create Game (Admin)
```http
POST /api/products
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Sample Game",
  "image": "data:image/png;base64,iVBORw0KGgo...", // Base64 encoded image (PNG or JPG)
  "brand": "Developer Name",
  "category": ["Genre1", "Genre2"],
  "description": "Game description",
  "disableRating": false,
  "disableCommenting": false,
  "optionalField1": "Optional content 1",
  "optionalField2": "Optional content 2"
}
```

#### Update Game (Admin)
```http
PUT /api/products/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Updated Game",
  "image": "data:image/jpeg;base64,/9j/4AAQ...", // Base64 encoded image (PNG or JPG)
  "brand": "Updated Developer",
  "category": ["Updated Genre1", "Updated Genre2"],
  "description": "Updated description",
  "disableRating": true,
  "disableCommenting": true
}
```

#### Enable/Disable Game Rating and Comments (Admin)
```http
PUT /api/products/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "disableRating": true,    // Set to true to disable rating, false to enable
  "disableCommenting": true // Set to true to disable commenting, false to enable
}
```

#### Delete Game (Admin)
```http
DELETE /api/products/:id
Authorization: Bearer {token}
```
**Notes:**
- When a game is deleted, all associated playtime records are removed from user profiles
- Keeps user data consistent by ensuring no orphaned game references

#### Add/Update Game Review (Rate/Comment)
```http
POST /api/products/:id/reviews
Authorization: Bearer {token}
Content-Type: application/json

{
  "rating": 4, // Optional (1-5). Required if no comment.
  "comment": "Great game!" // Optional. Required if no rating.
}
```
**Notes:**
- Requires user to have played the game for at least 1 hour (60 minutes).
- If the user has already reviewed, this updates their existing rating and/or comment.
- Fails if rating/commenting is disabled for the game by an admin.
- Rating must be between 1 and 5.

#### Play Game (Record Playtime)
```http
POST /api/products/:id/play
Authorization: Bearer {token}
Content-Type: application/json

{
  "time": 60 // Time played in minutes
}
```

#### Get Games Page (Detailed)
```http
GET /api/products/detailed
Authorization: Bearer {token}
```
**Response:**
```json
{
  "games": [
    {
      "_id": "game_id",
      "name": "Game Name",
      "image": "image_url",
      "brand": "Developer Name",
      "category": ["Action", "Adventure"],
      "description": "Game description",
      "playTime": 320, // Total playtime across all users in minutes
      "rating": 4.5, // Weighted average based on playtime
      "numReviews": 5,
      "disableRating": false,
      "disableCommenting": false,
      "reviews": [
        {
          "user": {
            "_id": "user_id",
            "name": "User Name"
          },
          "rating": 5,
          "comment": "Great game!",
          "createdAt": "2023-04-25T12:00:00.000Z",
          "userPlayTime": 240 // This user's playtime for this game (used for sorting)
        }
        // Reviews are sorted by user's playtime on this game (highest first)
      ],
      "optionalField1": "Optional content 1",
      "optionalField2": "Optional content 2"
    }
  ]
}
```

#### Get Game Comments (Sorted by Playtime)
```http
GET /api/products/:id/comments
Authorization: Bearer {token}
```
**Response:**
```json
{
  "gameId": "game_id",
  "gameName": "Game Name",
  "comments": [
    {
      "user": {
        "_id": "user_id",
        "name": "User Name"
      },
      "comment": "Great game!",
      "rating": 5,
      "userPlayTime": 240, // Used for sorting
      "createdAt": "2023-04-25T12:00:00.000Z"
    }
    // Comments are sorted by user's playtime (highest first)
  ]
}
```

#### Complete User Page Data
```http
GET /api/users/page
Authorization: Bearer {token}
```
**Response:**
```json
{
  "userName": "User Name",
  "averageRating": 4.2, // Average of all ratings given by the user
  "totalPlayTime": 540, // Total playtime across all games in minutes
  "mostPlayedGame": {
    "_id": "game_id",
    "name": "Game Name",
    "image": "image_url",
    "category": ["Action", "Adventure"],
    "playTime": 240 // User's playtime for this specific game
  },
  "comments": [
    {
      "gameId": "game_id",
      "gameName": "Game Name",
      "gameImage": "image_url",
      "category": ["Action", "Adventure"],
      "comment": "Great game!",
      "playTime": 240, // User's playtime for this game (used for sorting)
      "rating": 5,
      "createdAt": "2023-04-25T12:00:00.000Z"
    }
    // Comments are sorted by the user's playtime on each game (highest first)
  ]
}
```

## Image Upload

The API supports uploading images as base64-encoded strings.

### Supported Formats
- PNG: `data:image/png;base64,...`
- JPEG/JPG: `data:image/jpeg;base64,...` or `data:image/jpg;base64,...`

### Client-side Example
```javascript
// Function to convert file to base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

// Example usage with file input
document.getElementById('imageInput').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (file) {
    try {
      const base64Image = await fileToBase64(file);
      // base64Image can now be used in your API request
      console.log(base64Image);
    } catch (error) {
      console.error('Error converting file to base64:', error);
    }
  }
});
```

## Response Format

### Success Response
```json
{
  "data": {},
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "message": "Error message"
}
```

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```http
Authorization: Bearer your_jwt_token
```

## Error Codes

- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Server Error

## Data Models

### User
```javascript
{
  name: String,
  email: String,
  password: String, // Hashed
  isAdmin: Boolean,
  playTime: [ 
    { 
      product: ObjectId, // Ref to Product (Game)
      time: Number // Playtime for this game (in minutes)
    }
  ]
}
```

### Product (Game)
```javascript
{
  user: ObjectId, // User who created the game (Admin)
  name: String,
  image: String, // Base64 encoded image data
  brand: String, // Developer
  category: [String], // Array of genres (1-5)
  description: String,
  reviews: [
    {
      user: ObjectId,
      name: String,
      rating: Number,
      comment: String,
      timestamps: true
    }
  ],
  rating: Number, // Weighted average rating based on user playtime
  numReviews: Number,
  disableRating: Boolean, // Admin: Disable rating for this game
  disableCommenting: Boolean, // Admin: Disable commenting for this game
  // Optional fields can be added to this schema
}
```

## MongoDB Atlas Integration

This application connects to MongoDB Atlas for database services. Setup steps:

1. Create a MongoDB Atlas account at [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster
3. Set up database access (username and password)
4. Set up network access (IP whitelist)
5. Get your connection string and add it to your .env file
6. The application will automatically connect to MongoDB Atlas on startup

## Development

```bash
# Run in development mode
npm run dev

# Run tests
npm test
```

## Security

- Password hashing with bcrypt
- JWT authentication
- Input validation and sanitization
- Protected routes with middleware
- Admin-only routes
- CORS enabled
- Helmet security headers

## Environment Variables

- `PORT`: Server port (default: 3000)
- `MONGODB_URI`: MongoDB Atlas connection string
- `JWT_SECRET`: Secret key for JWT
- `NODE_ENV`: Environment (development/production)

## Rating Calculation Implementation

The game rating is calculated using a weighted average formula based on user playtime:

```
Rating = Σ(UserPlayTime * UserRating) / TotalPlayTimeOfGame
```

This means:
1. Each user's rating is weighted by their playtime
2. Users who play more have a stronger influence on the overall rating
3. The final rating is the sum of all weighted ratings divided by the total playtime

**Example Calculation:**
- User A: Played 100 minutes, rated 5 stars
- User B: Played 50 minutes, rated 3 stars
- User C: Played 150 minutes, rated 4 stars

Rating = ((100*5) + (50*3) + (150*4)) / (100+50+150) = (500 + 150 + 600) / 300 = 1250 / 300 = 4.17

This weighted average calculation is automatically performed whenever:
- A user rates a game
- A user's playtime for a game changes
- A user or their rating is removed

### Implementation Details

The rating is recalculated in the database using MongoDB aggregation pipeline, which:
1. Joins the user collection to get playtime data
2. Multiplies each rating by the user's playtime
3. Sums the products and divides by total playtime
4. Updates the game document with the new rating