import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.css'
})
export class UsuariosComponent implements OnInit {
  usuarios: any[] = [];
  usuarioLogueado: any = null;

  constructor(private router: Router, private cdr: ChangeDetectorRef) { }

  ngOnInit() {
    setTimeout(() => {
      const datosUsuario = localStorage.getItem('usuario');
      const token = localStorage.getItem('token');

      if (datosUsuario && token) {
        this.usuarioLogueado = JSON.parse(datosUsuario);
        if (this.usuarioLogueado.rol !== 'supervisor') {
          this.router.navigate(['/dashboard']);
          return;
        }
        this.cargarUsuarios();
      } else {
        this.router.navigate(['/login']);
      }
    }, 50);
  }

  async cargarUsuarios() {
    try {
      const token = localStorage.getItem('token');
      const url = `http://192.168.0.12:3000/api/usuarios?t=${new Date().getTime()}`;

      const respuesta = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (respuesta.ok) {
        const datos = await respuesta.json();
        this.usuarios = [...datos];

        this.cdr.detectChanges();

        console.log('Usuarios cargados correctamente tras recarga:', this.usuarios);
      } else {
        alert('Error al cargar la lista de usuarios.');
      }
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    }
  }

  async cambiarRol(num_empleado: string, nuevoRol: string) {

    if (num_empleado === this.usuarioLogueado?.num_empleado) {
      alert('Por motivos de seguridad, no puedes cambiar tu propio rol.');
      this.cargarUsuarios();
      return;
    }

    try {
      const respuesta = await fetch(`http://192.168.0.12:3000/api/usuarios/${num_empleado}/rol`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ rol: nuevoRol })
      });

      const datos = await respuesta.json();

      if (respuesta.ok) {
        alert(`Rol actualizado con éxito a: ${nuevoRol}`);

        if (num_empleado === this.usuarioLogueado.num_empleado) {
          this.usuarioLogueado.rol = nuevoRol;
          localStorage.setItem('usuario', JSON.stringify(this.usuarioLogueado));
          this.router.navigate(['/dashboard']);
        }
      } else {
        alert(datos.error || 'Hubo un error al actualizar el rol.');
        this.cargarUsuarios();
      }
    } catch (error) {
      alert('Error de conexión con el servidor.');
    }
  }
}