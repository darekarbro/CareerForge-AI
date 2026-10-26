const crypto = require('crypto');
const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/env');

class AuthService {
  constructor() {
    this.firebaseApp = null;

    if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
      try {
        const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
        if (admin.getApps().length === 0) {
          this.firebaseApp = admin.initializeApp({
            credential: admin.cert({
              projectId: env.FIREBASE_PROJECT_ID,
              clientEmail: env.FIREBASE_CLIENT_EMAIL,
              privateKey,
            }),
          });
        } else {
          this.firebaseApp = admin.getApp();
        }
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
      const auth = getAuth(this.firebaseApp);
      const decoded = await auth.verifyIdToken(idToken);
      return decoded;
    } catch (err) {
      console.error('Firebase verification failed:', {
        code: err.code,
        message: err.message,
      });
      const error = new Error('Invalid or expired Firebase token');
      error.statusCode = 401;
      error.details = err.message;
      throw error;
    }
  }

  async firebaseLogin({ idToken }) {
    const decoded = await this.verifyFirebaseToken(idToken);
    const profile = this.normalizeFirebaseProfile(decoded);

    if (!profile.uid || !profile.email || decoded.email_verified !== true ||
        decoded.firebase?.sign_in_provider !== 'google.com') {
      const error = new Error('A verified Google account is required');
      error.statusCode = 401;
      throw error;
    }

    let user = await User.findOne({ firebaseUid: profile.uid });
    if (!user) user = await User.findOne({ email: profile.email });
    if (user?.firebaseUid && user.firebaseUid !== profile.uid) {
      const error = new Error('This account is already linked to a different Google identity');
      error.statusCode = 409;
      throw error;
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
    const allowed = new Set(['name', 'targetRolePreference']);
    if (Object.keys(updateData).some((key) => !allowed.has(key))) {
      const error = new Error('Only name and targetRolePreference can be updated here');
      error.statusCode = 400;
      throw error;
    }
    for (const [key, value] of Object.entries(updateData)) {
      if (typeof value !== 'string' || !value.trim() || value.trim().length > 120) {
        const error = new Error(`${key} must contain between 1 and 120 characters`);
        error.statusCode = 400;
        throw error;
      }
    }
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: Object.fromEntries(Object.entries(updateData).map(([key, value]) => [key, value.trim()])) },
      { new: true, runValidators: true }
    ).select('-password');
    return user;
  }

  async changePassword(userId, { currentPassword, newPassword }) {
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
      const error = new Error('Provide your current password and a new password of 8 to 128 characters');
      error.statusCode = 400;
      throw error;
    }
    const user = await User.findById(userId).select('+password');
    if (!user || user.authProvider !== 'local' || !await user.comparePassword(currentPassword)) {
      const error = new Error('Current password is incorrect');
      error.statusCode = 401;
      throw error;
    }
    user.password = newPassword;
    await user.save();
    return { success: true };
  }
}

module.exports = new AuthService();
