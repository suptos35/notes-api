import mongoose from 'mongoose';

const NoteSchema = new mongoose.Schema(
  {
    owner: {
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
      default: '',
      maxlength: 10000
    }
  },
  {
    timestamps: true
  }
);

// Serves three queries:
//  1) user lists own notes:       find({owner}).sort({_id:-1})
//  2) admin lists all notes:      find({}).sort({_id:-1})   -> uses default _id index
//  3) admin filters by owner:     find({owner}).sort({_id:-1})
// Also serves cascade delete: deleteMany({owner}).
NoteSchema.index({ owner: 1, _id: -1 });

export const Note = mongoose.model('Note', NoteSchema);
