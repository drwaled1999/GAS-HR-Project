export function requirePermission(permission) { 
return (req, res, next) => {
  // اعداد اليوزر او ماعنده يوزر في الموقع 
  if (!req.user) {
    return res.status(401).json({message: "Unauthorized" });
  }
  // اعداد الاصلاحيات او مافي صلاحيات ب الاساس 
  if (!req.user.permissions || !Array.isArray(req.user.permissions)) { 
  return res.status(403).json({message: "No Permissions assgned" });
  }
  // تحقق من الصلاحيات 
  if (!req.user.permissions.includes(permission)) { 
  return res.status(403).json({message: " Forbidden " });
  }
  next(); 
} catch (error) {
  console.error("Permission error:", error);
  return res.status(500).json({message: "Permission check Failed" });

} 
   };
