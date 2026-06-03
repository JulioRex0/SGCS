import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService, CredencialesLogin, RespuestaLogin } from '../../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  credenciales: CredencialesLogin = {
    num_empleado: '',
    password: ''
  };

  constructor(private authService: AuthService) { }

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
      },
      error: (err: { error?: { error?: string } }) => {
        console.error('Error en el inicio de sesión:', err);
        const mensajeError = err.error?.error || 'Error al conectar con el servidor';
        alert(mensajeError);
      }
    });
  }
}