const cloudinary = require('cloudinary').v2;
const env = require('./env');
const fs = require('fs');
const path = require('path');

const isConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME &&
  env.CLOUDINARY_API_KEY &&
  env.CLOUDINARY_API_SECRET
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

/**
 * Uploads a file buffer or file path to Cloudinary or falls back to local uploads dir
 * @param {Buffer|string} fileSource - Buffer or path
 * @param {Object} options - upload options
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
const uploadFile = async (fileSource, options = {}) => {
  if (isConfigured) {
    try {
      const result = await new Promise((resolve, reject) => {
        const uploadOptions = {
          folder: 'careerforge_resumes',
          resource_type: 'auto',
          ...options,
        };

        if (Buffer.isBuffer(fileSource)) {
          const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
            if (error) return reject(error);
            resolve(result);
          });
          stream.end(fileSource);
        } else if (typeof fileSource === 'string') {
          cloudinary.uploader.upload(fileSource, uploadOptions, (error, result) => {
            if (error) return reject(error);
            resolve(result);
          });
        } else {
          reject(new Error('Invalid fileSource provided to uploadFile'));
        }
      });
      return result;
    } catch (cloudinaryError) {
      console.warn(
        `⚠️ Cloudinary upload failed (${cloudinaryError.message || cloudinaryError.http_code || 'Unknown error'}). Falling back to local uploads directory.`
      );
    }
  }

  // Fallback: Local storage simulation
  const uploadsDir = path.resolve(__dirname, '../../uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filename = `resume_${Date.now()}_${options.filename || 'document.pdf'}`;
  const targetPath = path.join(uploadsDir, filename);

  if (Buffer.isBuffer(fileSource)) {
    fs.writeFileSync(targetPath, fileSource);
  } else if (typeof fileSource === 'string' && fs.existsSync(fileSource)) {
    fs.copyFileSync(fileSource, targetPath);
  }

  return {
    secure_url: `/uploads/${filename}`,
    public_id: filename,
    fallback: true,
  };
};

module.exports = {
  cloudinary,
  isConfigured,
  uploadFile,
};
