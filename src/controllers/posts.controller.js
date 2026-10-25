import mongoose from 'mongoose';
import { Post } from '../models/Post.js';
import { User } from '../models/User.js';
import { parsePaginationParams, paginateQuery } from '../utils/pagination.js';
import { ApiError } from '../utils/ApiError.js';

export async function createPost(req, res, next) {
  try {
    const { title, content } = req.body;
    const post = await Post.create({
      author: req.user._id,
      title,
      content
    });

    res.status(201).json({ post });
  } catch (err) {
    next(err);
  }
}

export async function listFeed(req, res, next) {
  try {
    const { limit, cursor } = parsePaginationParams(req.query);
    // Uses default _id index
    const page = await paginateQuery(Post, {}, { limit, cursor });

    // Populate authors in single query (uses _id index)
    const authorIds = [...new Set(page.items.map((p) => p.author.toString()))];
    const authors = await User.find({ _id: { $in: authorIds } }, 'name').lean();
    const authorMap = new Map(authors.map((a) => [a._id.toString(), { _id: a._id, name: a.name }]));

    const items = page.items.map((post) => ({
      ...post,
      author: authorMap.get(post.author.toString()) || { _id: post.author, name: 'Unknown' }
    }));

    res.status(200).json({
      items,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Scenario 2: Retrieve all posts belonging to a particular user.
 * Constraint: Use a single aggregation pipeline with a $lookup stage.
 */
export async function getUserPosts(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid user ID format');
    }

    const { limit, cursor } = parsePaginationParams(req.query);

    const postPipeline = [
      ...(cursor ? [{ $match: { _id: { $lt: new mongoose.Types.ObjectId(cursor) } } }] : []),
      { $sort: { _id: -1 } },
      { $limit: limit + 1 },
      { $project: { title: 1, content: 1, createdAt: 1 } }
    ];

    const [doc] = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      { $project: { name: 1 } },
      {
        $lookup: {
          from: Post.collection.name,
          localField: '_id',
          foreignField: 'author',
          pipeline: postPipeline,
          as: 'posts'
        }
      }
    ]).option({ maxTimeMS: 5000 });

    if (!doc) {
      throw ApiError.notFound('User not found');
    }

    const rawPosts = doc.posts || [];
    const hasMore = rawPosts.length > limit;
    const posts = hasMore ? rawPosts.slice(0, limit) : rawPosts;
    const nextCursor = hasMore && posts.length > 0 ? posts[posts.length - 1]._id.toString() : null;

    res.status(200).json({
      user: {
        _id: doc._id,
        name: doc.name
      },
      posts,
      nextCursor,
      hasMore
    });
  } catch (err) {
    next(err);
  }
}
