import mongoose from 'mongoose';

mongoose.set('strictQuery', true);

export async function connectDB(uri) {
  return mongoose.connect(uri, {
    autoIndex: true
  });
}
