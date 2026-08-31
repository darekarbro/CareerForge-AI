const crypto = require('crypto');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/env');

class AuthService {
  constructor() {
    this.firebaseApp = null;

    if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
      try {
        const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
        this.firebaseApp = admin.initializeApp({
          credential: admin.cert({
            projectId: env.FIREBASE_PROJECT_ID,
            clientEmail: env.FIREBASE_CLIENT_EMAIL,
            privateKey,
          }),
        });
      } catch (err) {
        console.warn('Firebase Admin initialization warning:', err.message);
      }
    }
  }

  generateToken(user) {
    return jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      env.JWT_SECRET,
      {
        expiresIn: env.JWT_EXPIRES_IN,
      }
    );
  }

  normalizeFirebaseProfile(profile = {}) {
    const uid = String(profile.uid || '').trim();
    const email = String(profile.email || '').trim().toLowerCase();
    return {
      uid,
      email,
      name: profile.name || profile.displayName || email.split('@')[0] || 'Google User',
      picture: profile.picture || profile.photoURL || '',
    };
  }

  async verifyFirebaseToken(idToken) {
    if (!idToken) {
      const error = new Error('Firebase ID token is required');
      error.statusCode = 400;
      throw error;
    }

    if (!this.firebaseApp) {
      const error = new Error('Firebase Admin is not configured on the backend');
      error.statusCode = 500;
      throw error;
    }

    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      return decoded;
    } catch (err) {
      const error = new Error('Invalid or expired Firebase token');
      error.statusCode = 401;
      error.details = err.message;
      throw error;
    }
  }

  async firebaseLogin({ idToken }) {
    const decoded = await this.verifyFirebaseToken(idToken);
    const profile = this.normalizeFirebaseProfile(decoded);

    if (!profile.email) {
      const error = new Error('Firebase user email is required');
      error.statusCode = 401;
      throw error;
    }

    let user = await User.findOne({ email: profile.email.toLowerCase() });
    if (!user) {
      user = await User.findOne({ firebaseUid: profile.uid || '' });
    }

    if (!user) {
      user = await User.create({
        firebaseUid: profile.uid || undefined,
        name: profile.name || 'Google User',
        email: profile.email.toLowerCase(),
        password: `firebase-${crypto.randomBytes(24).toString('hex')}`,
        authProvider: 'firebase',
        avatarUrl: profile.picture || '',
        targetRolePreference: 'Fullstack Developer',
        lastLogin: new Date(),
      });
    } else {
      user.firebaseUid = user.firebaseUid || profile.uid || user.firebaseUid;
      user.name = user.name || profile.name || 'Google User';
      user.avatarUrl = user.avatarUrl || profile.picture || '';
      user.authProvider = user.authProvider || 'firebase';
      user.lastLogin = new Date();
      await user.save();
    }

    const token = this.generateToken(user);

    return {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        targetRolePreference: user.targetRolePreference,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  async register({ name, email, password, targetRolePreference }) {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      const error = new Error('An account with this email already exists');
      error.statusCode = 400;
      throw error;
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      targetRolePreference: targetRolePreference || 'Fullstack Developer',
      authProvider: 'local',
      lastLogin: new Date(),
    });

    const token = this.generateToken(user);

    return {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        targetRolePreference: user.targetRolePreference,
      },
    };
  }

  async login({ email, password }) {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    user.lastLogin = new Date();
    await user.save();

    const token = this.generateToken(user);

    return {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        targetRolePreference: user.targetRolePreference,
      },
    };
  }

  async getMe(userId) {
    const user = await User.findById(userId).select('-password');
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }
    return user;
  }

  async updateProfile(userId, updateData) {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');
    return user;
  }
}

module.exports = new AuthService();
