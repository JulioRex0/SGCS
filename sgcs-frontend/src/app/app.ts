import { Component, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router'; 

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet], 
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class AppComponent implements OnInit {
  title = 'sgcs-frontend';

  constructor(private router: Router) {}

  ngOnInit(): void {
    window.addEventListener('pageshow', (event) => {
      const token = localStorage.getItem('token');
      
      if (!token && this.router.url !== '/login') {
        localStorage.clear();
        this.router.navigate(['/login']);
      }
    });
  }
}