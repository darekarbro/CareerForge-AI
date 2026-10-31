const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    authVersion: { type: Number, default: 0 },
    emailVerifiedAt: Date,
    deleting: { type: Boolean, default: false },
    verificationHash: { type: String, select: false },
    verificationExpiresAt: { type: Date, select: false },
    resetHash: { type: String, select: false },
    resetExpiresAt: { type: Date, select: false },
    resetVersion: { type: Number, select: false },
    passwordChangedAt: { type: Date, select: false },
    privacy: {
      providers: { groq: { type: Boolean, default: false }, openrouter: { type: Boolean, default: false }, gemini: { type: Boolean, default: false } },
      activityDays: { type: Number, enum: [30, 90, 365], default: 90 },
      cacheDays: { type: Number, enum: [1, 7, 30], default: 7 },
      retryInputHours: { type: Number, enum: [1, 6, 24], default: 24 },
      updatedAt: Date,
    },
    firebaseUid: {
      type: String,
      default: undefined,
      set: (value) => typeof value === 'string' && value.trim() ? value.trim() : undefined,
      unique: true,
      sparse: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/\S+@\S+\.\S+/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user',
    },
    authProvider: {
      type: String,
      enum: ['local', 'firebase'],
      default: 'local',
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    targetRolePreference: {
      type: String,
      default: 'Fullstack Developer',
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
