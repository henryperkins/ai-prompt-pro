import { Navigate } from "react-router-dom";

const Feed = () => {
  return <Navigate to="/community?tab=following" replace />;
};

export default Feed;
