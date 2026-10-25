import mongoose from 'mongoose';

const PostSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120
    },
    content: {
      type: String,
      required: true,
      maxlength: 5000
    }
  },
  {
    timestamps: true
  }
);

// Serves: Scenario 2 $lookup (author equality + _id sort), and cascade delete.
PostSchema.index({ author: 1, _id: -1 });

export const Post = mongoose.model('Post', PostSchema);
