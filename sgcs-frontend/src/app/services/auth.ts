import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface CredencialesLogin {
  num_empleado: string;
  password: string;
}

export interface RespuestaLogin {
  mensaje: string;
  token: string;
  usuario: {
    nombre: string;
    rol: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = `http://${window.location.hostname}:3000/api`;

  constructor(private http: HttpClient) {}

  login(credenciales: CredencialesLogin): Observable<RespuestaLogin> {
    return this.http.post<RespuestaLogin>(`${this.apiUrl}/login`, credenciales);
  }
}
