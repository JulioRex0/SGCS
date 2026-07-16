import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('token');

  if (!token) {
    router.navigate(['/login']);
    return false;
  }

  try {
    const decoded: any = jwtDecode(token);
    const fechaExpiracion = decoded.exp * 1000; 
    
    if (Date.now() >= fechaExpiracion) {
      localStorage.clear();
      router.navigate(['/login']);
      return false;
    }
    
    return true;
  } catch (error) {
    localStorage.clear();
    router.navigate(['/login']);
    return false;
  }
};