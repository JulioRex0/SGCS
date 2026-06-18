import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

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
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})

export class DashboardComponent {
  salaSeleccionada: number = 1;

  salas = []; 

menuColapsado: boolean = false;

  // Función para alternar el menú
  toggleMenu() {
    this.menuColapsado = !this.menuColapsado;
  }

  seleccionarSala(numero: number) {
    this.salaSeleccionada = numero;
    console.log(`Cambiando a la vista detallada de la Sala ${numero}`);
    // Aquí implementaremos más adelante el cambio de vista o la carga de datos específicos
  }

  verDatosUsuario() {
    alert("Abriendo modal con los datos completos del perfil de Julio Gomez.");
  }

  cerrarSesion() {
    console.log("Cerrando sesión y destruyendo token.");
    localStorage.clear();
  }
}