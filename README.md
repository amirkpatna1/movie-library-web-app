Step 1) run - npm install
step 2) Create .env file and store following things with exact same key.
DB =Your mongodb database connection url.
CLIENT_ID=Your Google developer console client id.
CLIENT_SECRET=Your Google developer console client secret.
set the redirect URL to http://localhost:3000/auth/google/search
step 3) to run
node app.js 