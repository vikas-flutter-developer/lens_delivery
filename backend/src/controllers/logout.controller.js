export const logout = (req, res) => {
  res.cookie('jwt', '', {
    httpOnly: true,
    expires: new Date(0), // Expire immediately
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  
  res.status(200).json({ message: 'Logged out successfully' });
};