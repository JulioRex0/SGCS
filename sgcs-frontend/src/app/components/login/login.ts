import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService, CredencialesLogin, RespuestaLogin } from '../../services/auth';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent implements OnInit {
  credenciales: CredencialesLogin = {
    num_empleado: '',
    password: ''
  };

  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit() {
    localStorage.clear();
  }

  onLogin() {
    if (!this.credenciales.num_empleado || !this.credenciales.password) {
      alert('Por favor, llena todos los campos');
      return;
    }

    console.log('Enviando datos al servidor...');
    this.authService.login(this.credenciales).subscribe({
      next: (respuesta: RespuestaLogin) => {
        console.log('¡Backend respondió con éxito!', respuesta);
        alert(`¡Bienvenido de nuevo, ${respuesta.usuario.nombre}!`);
        
        localStorage.setItem('token', respuesta.token);
        localStorage.setItem('usuario', JSON.stringify(respuesta.usuario));
        
        this.router.navigate(['/dashboard']);
      },
      error: (err: HttpErrorResponse) => {
        console.error('Error en el inicio de sesión:', err);
        
        const mensajeError = err.error?.error || 'Error al conectar con el servidor (Verifica tu red)';
        alert(mensajeError);
      }
    });
  }
}