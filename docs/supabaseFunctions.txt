calculate_available_slots

DECLARE
BEGIN
    -- Input validation check (remains the same)
    PERFORM NULL::timestamptz -- Use timestamptz here just for the check, doesn't affect logic
    WHERE in_start_date IS NULL OR in_end_date IS NULL OR in_service_id IS NULL OR in_start_date > in_end_date
    LIMIT 0;

    -- CTE definitions
    RETURN QUERY
    WITH RelevantDates AS (
        -- Generates dates within the requested range (remains the same)
        SELECT generate_series(in_start_date, in_end_date, interval '1 day')::date AS potential_date
    ),
    PotentialRuleSlots AS (
        -- Generates potential naive timestamp slots based on rules
        SELECT
            r.id AS rule_id,
            r.field_ids,
            r.start_time AS rule_start_time, -- This is TIME WITHOUT TIME ZONE
            r.end_time AS rule_end_time,     -- This is TIME WITHOUT TIME ZONE
            r.use_staff_vehicle_capacity,
            rd.potential_date,
            -- *** CHANGE: Generate naive timestamp by combining date and time ***
            (rd.potential_date + r.start_time)::timestamp AS potential_start, -- Result is TIMESTAMP WITHOUT TIME ZONE
            (rd.potential_date + r.end_time)::timestamp AS potential_end       -- Result is TIMESTAMP WITHOUT TIME ZONE
        FROM
            RelevantDates rd
        JOIN
            public.service_availability r ON r.service_id = in_service_id AND r.is_active = true
        WHERE
            -- Rule matching logic (remains the same, compares dates and days)
            (r.specific_date = rd.potential_date OR (r.specific_date IS NULL AND EXTRACT(ISODOW FROM rd.potential_date) = ANY(r.days_of_week)))
    ),
    StaffCapacity AS (
      -- Calculates capacity for staff-based rules
      SELECT
        prs.potential_start, prs.potential_end, prs.rule_start_time, prs.rule_end_time, prs.potential_date,
        -- Check if staff is generally available for the rule's time/date (uses naive time/date parts, should be OK)
        (CASE WHEN prs.use_staff_vehicle_capacity = FALSE OR in_client_default_staff_id IS NULL THEN FALSE ELSE EXISTS (
             SELECT 1 FROM public.staff s LEFT JOIN public.staff_availability sa ON s.id = sa.staff_id
             WHERE s.id = in_client_default_staff_id AND s.default_vehicle_id IS NOT NULL AND sa.is_available = TRUE
               AND sa.start_time <= prs.rule_start_time AND sa.end_time >= prs.rule_end_time -- Compares TIME values
               AND (sa.specific_date = prs.potential_date OR (sa.specific_date IS NULL AND EXTRACT(ISODOW FROM prs.potential_date) = ANY(sa.days_of_week))) -- Compares DATE/DAY values
           ) END) AS is_staff_available,
        -- Calculate remaining vehicle capacity considering overlapping bookings
        CASE WHEN prs.use_staff_vehicle_capacity = FALSE OR in_client_default_staff_id IS NULL THEN CASE WHEN prs.use_staff_vehicle_capacity = TRUE THEN 0 ELSE NULL END ELSE (
             WITH StaffAvailCheck AS (SELECT 1 FROM public.staff_availability sa WHERE sa.staff_id = in_client_default_staff_id AND sa.is_available = TRUE AND sa.start_time <= prs.rule_start_time AND sa.end_time >= prs.rule_end_time AND (sa.specific_date = prs.potential_date OR (sa.specific_date IS NULL AND EXTRACT(ISODOW FROM prs.potential_date) = ANY(sa.days_of_week))) LIMIT 1)
            , VehicleCapCheck AS (SELECT v.pet_capacity FROM public.staff s JOIN public.vehicles v ON s.default_vehicle_id = v.id WHERE s.id = in_client_default_staff_id LIMIT 1)
            , StaffBookedCount AS (
                SELECT COUNT(bp.id) AS count
                FROM public.bookings b JOIN public.booking_pets bp ON b.id = bp.booking_id JOIN public.staff st ON st.id = in_client_default_staff_id
                WHERE b.assigned_staff_id = st.user_id AND b.status != 'cancelled'
                -- *** CHANGE: Use naive timestamp range overlap check ***
                AND tsrange(b.start_time, b.end_time, '()') && tsrange(prs.potential_start, prs.potential_end, '()') -- Assumes bookings.start/end_time are now naive timestamps
            )
            SELECT CASE WHEN EXISTS (SELECT 1 FROM StaffAvailCheck) AND EXISTS (SELECT 1 FROM VehicleCapCheck) THEN GREATEST(0, COALESCE((SELECT pet_capacity FROM VehicleCapCheck), 0) - COALESCE((SELECT count FROM StaffBookedCount), 0)) ELSE 0 END
          ) END::INT AS calculated_capacity
      FROM PotentialRuleSlots prs
      WHERE prs.use_staff_vehicle_capacity = TRUE
    ),
    NonStaffCapacity AS (
       -- Handles non-staff capacity (no change needed here)
       SELECT prs.potential_start, prs.potential_end, NULL::INT AS calculated_capacity
       FROM PotentialRuleSlots prs WHERE prs.use_staff_vehicle_capacity = FALSE
    )
    -- Final SELECT combining results
    SELECT
        prs.potential_start AS slot_start_time, -- Now selects the naive timestamp
        prs.potential_end AS slot_end_time,     -- Now selects the naive timestamp
        CASE WHEN prs.use_staff_vehicle_capacity = TRUE THEN COALESCE(sc.calculated_capacity, 0) ELSE nsc.calculated_capacity END AS slot_remaining_capacity,
        prs.use_staff_vehicle_capacity AS rule_uses_staff_capacity,
        prs.field_ids AS associated_field_ids,
        -- Zero capacity reason logic (remains the same)
        CASE WHEN (CASE WHEN prs.use_staff_vehicle_capacity = TRUE THEN COALESCE(sc.calculated_capacity, 0) ELSE 999999 END) > 0 THEN NULL
             WHEN prs.use_staff_vehicle_capacity = TRUE THEN CASE WHEN sc.is_staff_available = TRUE THEN 'staff_full'::text ELSE 'no_staff'::text END
             ELSE NULL::text
        END AS zero_capacity_reason,
        -- Check for other available staff logic (uses naive time/date parts, should be OK)
        CASE
            WHEN prs.use_staff_vehicle_capacity = TRUE AND COALESCE(sc.calculated_capacity, 0) = 0 THEN (
                SELECT EXISTS (
                    SELECT 1
                    FROM public.staff_availability sa
                    WHERE sa.staff_id != in_client_default_staff_id
                      AND sa.is_available = TRUE
                      AND sa.start_time <= prs.rule_start_time
                      AND sa.end_time >= prs.rule_end_time
                      AND (
                           sa.specific_date = prs.potential_date
                           OR
                           (sa.specific_date IS NULL AND EXTRACT(ISODOW FROM prs.potential_date) = ANY(sa.days_of_week))
                      )
                    LIMIT 1
                )
            )
            ELSE FALSE
        END AS other_staff_potentially_available
    FROM
        PotentialRuleSlots prs
    LEFT JOIN StaffCapacity sc ON prs.potential_start = sc.potential_start AND prs.potential_end = sc.potential_end AND prs.use_staff_vehicle_capacity = TRUE
    LEFT JOIN NonStaffCapacity nsc ON prs.potential_start = nsc.potential_start AND prs.potential_end = nsc.potential_end AND prs.use_staff_vehicle_capacity = FALSE;

END;



////////////////////////////////////////

check_array_elements_range

DECLARE
  el INTEGER;
BEGIN
  IF arr IS NULL THEN
    RETURN TRUE; -- Null arrays satisfy the check
  END IF;
  IF array_length(arr, 1) = 0 THEN
    RETURN TRUE; -- Empty arrays satisfy the check
  END IF;
  FOREACH el IN ARRAY arr LOOP
    IF el < min_val OR el > max_val THEN
      RETURN FALSE; -- Element out of range
    END IF;
  END LOOP;
  RETURN TRUE; -- All elements are within range
END;

/////////////////////////////////////////


handle_new_user

BEGIN
  -- Insert into profiles table using metadata passed during signup
  INSERT INTO public.profiles (user_id, first_name, last_name, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.raw_user_meta_data ->> 'phone'
  );

  -- Optionally, insert into clients with just user_id and email
  INSERT INTO public.clients (user_id, email)
  VALUES (NEW.id, NEW.email);

  RETURN NEW;
END;



update_staff_availability_updated_at


BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
