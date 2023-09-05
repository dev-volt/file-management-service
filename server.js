require("dotenv").config();
const express = require("express");
const AWS = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");
const jwt = require("jsonwebtoken");

const app = express();
const port = process.env.PORT || 1337;
const secret = process.env.JWT_SECRET;

// Initialize AWS S3
AWS.config.update({
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

// Middleware to authenticate JWT token
const authenticateJWT = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token) return res.status(401).send("Access Denied");

  jwt.verify(token, secret, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Configure multer to use S3 for storage
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE, // Automatically set the content type
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      cb(null, Date.now().toString() + "-" + file.originalname);
    },
  }),
});

// Upload image to S3
app.post("/upload", authenticateJWT, upload.single("image"), (req, res) => {
  const downloadUrl = `${process.env.APP_URL}/download/${req.file.key}`;
  res.json({ url: downloadUrl });
});

// Download image from S3 using buffer
app.get("/download/:key", authenticateJWT, (req, res) => {
  const params = {
    Bucket: process.env.BUCKET_NAME,
    Key: req.params.key,
  };

  s3.getObject(params, (err, data) => {
    console.log("s3.getObject // data:", data);

    if (err) {
      res.status(400).send(err);
      return;
    }
    res.writeHead(200, { "Content-Type": data.ContentType });
    res.end(data.Body);
  });
});

// Generate a JWT token for testing
app.get("/token", (req, res) => {
  const token = jwt.sign({ username: "testUser" }, secret);
  res.send({ token });
});

app.listen(port, () => {
  console.log(`Server running at ${process.env.APP_URL}`);
});
