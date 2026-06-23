import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css'
})
export class PerfilComponent implements OnInit {
  usuarioActivo: any = null;
  nuevoNombre: string = '';

  constructor(private router: Router) { }

  ngOnInit() {
    const datosUsuario = localStorage.getItem('usuario');
    if (datosUsuario) {
      this.usuarioActivo = JSON.parse(datosUsuario);
      this.nuevoNombre = this.usuarioActivo.nombre;
    } else {
      this.router.navigate(['/login']);
    }
  }

  async guardarCambios() {
    if (!this.nuevoNombre.trim()) {
      alert('El nombre no puede estar vacío.');
      return;
    }

    try {
      // Cambiar la IP mas adelante cuando se tenga el dominio o IP fija del backend
      const respuesta = await fetch(`http://192.168.0.12:3000/api/usuarios/${this.usuarioActivo.num_empleado}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ nombre: this.nuevoNombre })
      });

      const datos = await respuesta.json();

      if (respuesta.ok) {
        alert('¡Nombre actualizado con éxito!');

        this.usuarioActivo.nombre = this.nuevoNombre;
        localStorage.setItem('usuario', JSON.stringify(this.usuarioActivo));

        this.router.navigate(['/dashboard']);

      } else {
        alert(datos.error || 'Hubo un error al actualizar.');
      }
    } catch (error) {
      console.error('Error al actualizar el perfil:', error);
      alert('No se pudo conectar con el servidor.');
    }
  }
}