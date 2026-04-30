import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI in .env.local');
}
console.log(MONGODB_URI);
interface CachedMongoose {
  conn: typeof mongoose | null; 
  promise: Promise<typeof mongoose> | null;
}

const globalWithMongoose = global as typeof global & { _mongoose?: CachedMongoose };

if (!globalWithMongoose._mongoose) {
  globalWithMongoose._mongoose = { conn: null, promise: null };
}

const cached = globalWithMongoose._mongoose;

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
