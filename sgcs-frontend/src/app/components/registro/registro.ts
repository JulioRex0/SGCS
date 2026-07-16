import { Component, ViewEncapsulation} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
  encapsulation: ViewEncapsulation.None
})
export class RegistroComponent {
  
  nuevoUsuario = {
    num_empleado: '',
    nombre: '',
    password: '',
    rol: ''
  };

  constructor(private router: Router) {}

  async onRegistro() {
    try {
      const respuesta = await fetch('http://localhost:3000/api/registro', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(this.nuevoUsuario)
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(datos.error || 'Error al registrar');
      }

      alert('¡Empleado registrado con éxito! Ya puede iniciar sesión.');
      this.router.navigate(['/login']);

    } catch (error: any) {
      console.error('Error en el registro:', error);
      alert(error.message || 'No se pudo conectar con el servidor.');
    }
  }
}