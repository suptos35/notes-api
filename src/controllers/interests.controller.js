import { User } from '../models/User.js';

/**
 * Scenario 1: Group users by interests using a single aggregation pipeline.
 * Constraint: You must use exactly one collection.aggregate() call. Do not use any other methods.
 */
export async function getGroupedByInterests(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const rawInterest = req.query.interest ? req.query.interest.trim().toLowerCase() : undefined;
    const interest = rawInterest && rawInterest.length > 0 ? rawInterest : undefined;

    const skip = (page - 1) * limit;
    const leadingMatch = interest
      ? { interests: interest } // Equality on multikey index
      : { interests: { $gt: '' } }; // Range scan bounded to non-empty interests via multikey index

    const [result] = await User.aggregate([
      { $match: leadingMatch },
      { $unwind: '$interests' },
      ...(interest ? [{ $match: { interests: interest } }] : []),
      {
        $group: {
          _id: '$interests',
          count: { $sum: 1 },
          users: { $push: { _id: '$_id', name: '$name' } }
        }
      },
      { $sort: { _id: 1 } },
      {
        $facet: {
          groups: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 0,
                interest: '$_id',
                count: 1,
                users: { $slice: ['$users', 20] }
              }
            }
          ],
          total: [{ $count: 'n' }]
        }
      }
    ]).option({ maxTimeMS: 5000 });

    const groups = result?.groups || [];
    const totalGroups = result?.total?.[0]?.n ?? 0;
    const hasMore = skip + groups.length < totalGroups;

    res.status(200).json({
      groups,
      page,
      limit,
      totalGroups,
      hasMore
    });
  } catch (err) {
    next(err);
  }
}
