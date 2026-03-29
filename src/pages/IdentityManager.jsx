import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function IdentityManager() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/VeloIdentityHub', { replace: true }); }, [navigate]);
  return null;
}
