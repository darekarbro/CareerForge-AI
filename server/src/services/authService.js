const crypto = require('crypto');
const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');
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

  generateToken(user, agent) { return require('./sessionService').issue(user, agent); }

  publicUser(user) {
    return { id: user._id, name: user.name, email: user.email, role: user.role,
      targetRolePreference: user.targetRolePreference, avatarUrl: user.avatarUrl || '', authProvider: user.authProvider,
      emailVerifiedAt: user.emailVerifiedAt || null, createdAt: user.createdAt };
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

  async firebaseLogin({ idToken, userAgent }) {
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
      if (user.deleting) throw Object.assign(new Error('This account is being deleted'), { statusCode: 403 });
      user.firebaseUid = user.firebaseUid || profile.uid || user.firebaseUid;
      user.name = user.name || profile.name || 'Google User';
      user.avatarUrl = user.avatarUrl || profile.picture || '';
      user.authProvider = user.authProvider || 'firebase';
      user.lastLogin = new Date();
      await user.save();
    }
    if (!user.emailVerifiedAt) { user.emailVerifiedAt = new Date(); await user.save(); }
    const token = await this.generateToken(user, userAgent);
    return { token, user: this.publicUser(user) };
  }

  async register({ name, email, password, targetRolePreference, userAgent }) {
    if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72) throw Object.assign(new Error('Password must contain at least 8 characters and at most 72 UTF-8 bytes'), { statusCode: 400 });
    const existingUser = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingUser) {
      const error = new Error('An account with this email already exists');
      error.statusCode = 400;
      throw error;
    }

    const user = await User.create({
      name,
      email: email.trim().toLowerCase(),
      password,
      targetRolePreference: targetRolePreference || 'Fullstack Developer',
      authProvider: 'local',
      lastLogin: new Date(),
    });

    const token = await this.generateToken(user, userAgent);
    await require('./accountMailService').request(user.email, 'verify');
    return { token, user: this.publicUser(user) };
  }

  async login({ email, password, userAgent }) {
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
    if (!user || user.deleting) {
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

    const token = await this.generateToken(user, userAgent);
    return { token, user: this.publicUser(user) };
  }

  async getMe(userId) {
    const user = await User.findById(userId).select('-password');
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }
    return this.publicUser(user);
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
    return this.publicUser(user);
  }

  async changePassword(userId, { currentPassword, newPassword }) {
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128 || Buffer.byteLength(newPassword, 'utf8') > 72) {
      const error = new Error('Provide your current password and a new password of at least 8 characters and at most 72 UTF-8 bytes');
      error.statusCode = 400;
      throw error;
    }
    const user = await User.findById(userId).select('+password');
    if (!user || user.authProvider !== 'local' || !await user.comparePassword(currentPassword)) {
      const error = new Error('Current password is incorrect');
      error.statusCode = 401; error.code = 'REAUTH_REQUIRED';
      throw error;
    }
    user.password = newPassword;
    user.passwordChangedAt = new Date();
    user.authVersion = (user.authVersion || 0) + 1;
    user.resetHash = undefined; user.resetExpiresAt = undefined; user.resetVersion = undefined;
    await user.save();
    await require('../models/AuthSession').deleteMany({ owner: userId });
    require('../config/socket').disconnectUserSockets(userId);
    return { success: true };
  }

  async verifyEmail(token) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw Object.assign(new Error('This verification link is invalid or expired'), { statusCode: 400 });
    const user = await User.findOneAndUpdate({ verificationHash: require('./privatePayload').digest(token), verificationExpiresAt: { $gt: new Date() }, deleting: { $ne: true } },
      { $set: { emailVerifiedAt: new Date() }, $unset: { verificationHash: 1, verificationExpiresAt: 1 } });
    if (!user) throw Object.assign(new Error('This verification link is invalid or expired'), { statusCode: 400 });
    return { verified: true };
  }

  async resetPassword(token, password) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || typeof password !== 'string' || password.length < 8 || password.length > 128 || Buffer.byteLength(password, 'utf8') > 72) throw Object.assign(new Error('Provide a valid reset link and a password of 8–72 UTF-8 bytes'), { statusCode: 400 });
    const hash = require('./privatePayload').digest(token), encoded = await require('bcryptjs').hash(password, 12);
    const user = await User.findOneAndUpdate({ resetHash: hash, resetExpiresAt: { $gt: new Date() }, deleting: { $ne: true }, $expr: { $eq: [{ $ifNull: ['$authVersion', 0] }, '$resetVersion'] } },
      { $set: { password: encoded, passwordChangedAt: new Date() }, $inc: { authVersion: 1 }, $unset: { resetHash: 1, resetExpiresAt: 1, resetVersion: 1 } });
    if (!user) throw Object.assign(new Error('This reset link is invalid or expired'), { statusCode: 400 });
    await require('../models/AuthSession').deleteMany({ owner: user._id });
    require('../config/socket').disconnectUserSockets(user._id);
    return { reset: true };
  }
}

module.exports = new AuthService();
