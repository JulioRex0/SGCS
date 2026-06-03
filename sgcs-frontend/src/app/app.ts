import { Component } from '@angular/core';
import { LoginComponent } from './components/login/login'; // Ruta directa al archivo login.ts

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [LoginComponent], // Ahora Angular sí sabrá con certeza que es un componente válido
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class AppComponent {
  title = 'sgcs-frontend';
}