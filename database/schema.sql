CREATE TABLE `users` (
  `user_id` varchar(50) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `balance` decimal(15,2) DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tuition` (
  `tuition_id` varchar(50) NOT NULL,
  `student_id` varchar(50) NOT NULL,
  `semester` varchar(20) NOT NULL,
  `amount_due` decimal(15,2) NOT NULL,
  `amount_paid` decimal(15,2) DEFAULT 0.00,
  `status` varchar(10) NOT NULL CHECK (`status` in ('unpaid','partial','paid'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `students` (
  `student_id` varchar(50) NOT NULL,
  `full_name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `payments` (
  `payment_id` varchar(50) NOT NULL,
  `user_id` varchar(50) NOT NULL,
  `tuition_id` varchar(50) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `payment_date` datetime DEFAULT current_timestamp(),
  `status` varchar(10) NOT NULL CHECK (`status` in ('pending','success','failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `otp` (
  `otp_id` varchar(50) NOT NULL,
  `payment_id` varchar(50) NOT NULL,
  `otp_code` varchar(10) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `expired_at` datetime NOT NULL,
  `is_used` bit(1) DEFAULT b'0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE `otp`
  ADD PRIMARY KEY (`otp_id`),
  ADD UNIQUE KEY `payment_id` (`payment_id`);

--
-- Indexes for table `payments`
--
ALTER TABLE `payments`
  ADD PRIMARY KEY (`payment_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `tuition_id` (`tuition_id`);

--
-- Indexes for table `students`
--
ALTER TABLE `students`
  ADD PRIMARY KEY (`student_id`);

--
-- Indexes for table `tuition`
--
ALTER TABLE `tuition`
  ADD PRIMARY KEY (`tuition_id`),
  ADD KEY `student_id` (`student_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`);


-- Constraints for table `otp`
--
ALTER TABLE `otp`
  ADD CONSTRAINT `otp_ibfk_1` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`payment_id`);

--
-- Constraints for table `payments`
--
ALTER TABLE `payments`
  ADD CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `payments_ibfk_2` FOREIGN KEY (`tuition_id`) REFERENCES `tuition` (`tuition_id`);

--
-- Constraints for table `tuition`
--
ALTER TABLE `tuition`
  ADD CONSTRAINT `tuition_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`);
COMMIT;
