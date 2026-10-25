import mongoose from 'mongoose';
import { ApiError } from './ApiError.js';

/**
 * Validates and parses limit and cursor from query parameters
 * 
 * @param {Object} query - req.query
 * @param {number} [defaultLimit=10]
 * @param {number} [maxLimit=50]
 * @returns {{ limit: number, cursor: mongoose.Types.ObjectId | null }}
 */
export function parsePaginationParams(query, defaultLimit = 10, maxLimit = 50) {
  let limit = defaultLimit;
  if (query.limit !== undefined) {
    const parsed = parseInt(query.limit, 10);
    if (isNaN(parsed) || parsed < 1) {
      throw ApiError.badRequest('Query parameter "limit" must be a positive integer');
    }
    limit = Math.min(parsed, maxLimit);
  }

  let cursor = null;
  if (query.cursor) {
    if (!mongoose.Types.ObjectId.isValid(query.cursor)) {
      throw ApiError.badRequest('Invalid cursor format. Must be a valid ObjectId');
    }
    cursor = new mongoose.Types.ObjectId(query.cursor);
  }

  return { limit, cursor };
}

/**
 * Executes a keyset-paginated query sorted by _id: -1
 * 
 * @param {mongoose.Model} model - Mongoose model
 * @param {Object} filter - Base MongoDB query filter
 * @param {{ limit: number, cursor: mongoose.Types.ObjectId | null }} paginationParams
 * @param {string | Object} [select] - Fields projection
 * @returns {Promise<{ items: Array, nextCursor: string | null, hasMore: boolean }>}
 */
export async function paginateQuery(model, filter, { limit, cursor }, select) {
  const queryFilter = {
    ...filter,
    ...(cursor ? { _id: { $lt: cursor } } : {})
  };

  let query = model.find(queryFilter).sort({ _id: -1 }).limit(limit + 1).lean();
  if (select) {
    query = query.select(select);
  }

  const results = await query.exec();
  const hasMore = results.length > limit;
  const items = hasMore ? results.slice(0, limit) : results;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]._id.toString() : null;

  return {
    items,
    nextCursor,
    hasMore
  };
}
