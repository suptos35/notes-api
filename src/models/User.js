import mongoose from 'mongoose';
import { normalizeInterests } from '../utils/normalizeInterests.js';

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 80
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    },
    interests: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Normalize interests on save
UserSchema.pre('save', function (next) {
  if (this.isModified('interests')) {
    this.interests = normalizeInterests(this.interests);
  }
  next();
});

// Serves: login lookup by email, duplicate check on register/admin-create.
UserSchema.index({ email: 1 }, { unique: true });

// Serves: Scenario 1. Multikey index on interests; leading $match uses it.
UserSchema.index({ interests: 1 });

export const User = mongoose.model('User', UserSchema);
