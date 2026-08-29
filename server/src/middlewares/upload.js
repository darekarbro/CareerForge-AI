const multer = require('multer');
const path = require('path');

// Store file in memory buffer so parser and Cloudinary helper can process it
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.pdf', '.docx', '.doc', '.txt'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(ext)) {
    return cb(null, true);
  }

  cb(new Error('Only .pdf, .docx, and .txt files are allowed!'), false);
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter,
});

module.exports = upload;
