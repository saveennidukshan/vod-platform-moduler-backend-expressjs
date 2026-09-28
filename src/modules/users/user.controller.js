import {
  getCurrentUserProfile as getCurrentUserProfileService,
  getUserForAdminById,
  listUsersForAdmin,
  updateCurrentUserProfile,
  updateUserByAdmin,
} from './user.service.js';

export const getCurrentUserProfile = async (req, res) => {
  const user = await getCurrentUserProfileService(req.auth.sub);
  return res.status(200).json({
    success: true,
    message: 'Current user fetched successfully',
    data: {
      user,
    },
  });
};

export const updateCurrentUser = async (req, res) => {
  const user = await updateCurrentUserProfile({
    userId: req.auth.sub,
    email: req.body.email,
  });

  return res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user,
    },
  });
};

export const getUsers = async (req, res) => {
  const result = await listUsersForAdmin({
    page: req.query.page,
    limit: req.query.limit,
    role: req.query.role,
    isEmailVerified: req.query.isEmailVerified,
    search: req.query.search,
    sortBy: req.query.sortBy,
    sortOrder: req.query.sortOrder,
  });

  return res.status(200).json({
    success: true,
    message: 'Users fetched successfully',
    data: {
      users: result.users,
      pagination: result.pagination,
    },
  });
};

export const getUserById = async (req, res) => {
  const user = await getUserForAdminById(req.params.id);
  return res.status(200).json({
    success: true,
    message: 'User fetched successfully',
    data: {
      user,
    },
  });
};

export const updateUser = async (req, res) => {
  const user = await updateUserByAdmin(req.params.id, req.body);
  return res.status(200).json({
    success: true,
    message: 'User updated successfully',
    data: {
      user,
    },
  });
};
