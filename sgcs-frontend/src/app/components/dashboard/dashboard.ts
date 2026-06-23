import { Component, OnInit } from '@angular/core'; 
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

interface Sala {
  numero: number;
  pelicula: string;
  estado: 'disponible' | 'limpiando' | 'sucia';
  proximaApertura: string;
  tiempoEstimado?: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit { 
  salaSeleccionada: number = 1;
  salas = []; 
  menuColapsado: boolean = false;

  usuarioActivo: any = null;

  constructor(private router: Router) {}

  ngOnInit() {
    const datosUsuario = localStorage.getItem('usuario');
    if (datosUsuario) {
      this.usuarioActivo = JSON.parse(datosUsuario);
      console.log('Usuario activo en el Dashboard:', this.usuarioActivo);
    }
  }

  toggleMenu() {
    this.menuColapsado = !this.menuColapsado;
  }

  seleccionarSala(numero: number) {
    this.salaSeleccionada = numero;
    console.log(`Cambiando a la vista detallada de la Sala ${numero}`);
  }

  verDatosUsuario() {
    alert(`Perfil:\nNombre: ${this.usuarioActivo?.nombre}\nID: ${this.usuarioActivo?.num_empleado}\nRol: ${this.usuarioActivo?.rol}`);
  }

  cerrarSesion() {
    console.log("Cerrando sesión, destruyendo token y redirigiendo.");
    localStorage.clear(); 
    this.router.navigate(['/login']); 
  }
}