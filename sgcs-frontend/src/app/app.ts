import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router'; 
import { LoginComponent } from './components/login/login'; 

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet], 
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class AppComponent {
  title = 'sgcs-frontend';
}