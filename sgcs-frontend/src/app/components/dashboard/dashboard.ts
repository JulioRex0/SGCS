import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterModule } from '@angular/router';

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
  imports: [CommonModule, RouterModule, RouterOutlet],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {
  salaSeleccionada: number | null = null;
  salas: Sala[] = [];
  menuColapsado: boolean = true;
  usuarioActivo: any = null;

  constructor(private router: Router) { }

  ngOnInit() {
    const datosUsuario = localStorage.getItem('usuario');
    if (datosUsuario) {
      this.usuarioActivo = JSON.parse(datosUsuario);
      console.log('Usuario activo en el Dashboard:', this.usuarioActivo);
    }

    if (this.router.url === '/dashboard') {
      this.salaSeleccionada = null;
      this.menuColapsado = true; 
    } else if (this.router.url.includes('/dashboard/salas/')) {
      const partes = this.router.url.split('/');
      this.salaSeleccionada = parseInt(partes[partes.length - 1], 10);
      this.menuColapsado = true; 
    }
  }

  toggleMenu() {
    this.menuColapsado = !this.menuColapsado;
  }

  seleccionarSala(numero: number) {
    this.salaSeleccionada = numero;
    this.menuColapsado = true; 
    console.log(`Cambiando a la vista detallada de la Sala ${numero} y colapsando menú`);
  }

  irADatosGenerales() {
    this.salaSeleccionada = null; 
    this.menuColapsado = false; 
    this.router.navigate(['/dashboard']); 
    console.log('Regresando a los datos generales y expandiendo menú');
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

